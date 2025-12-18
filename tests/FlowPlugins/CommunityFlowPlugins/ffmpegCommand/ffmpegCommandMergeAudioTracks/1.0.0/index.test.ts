import { plugin } from
  '../../../../../../FlowPluginsTs/CommunityFlowPlugins/ffmpegCommand/ffmpegCommandMergeAudioTracks/1.0.0/index';
import { IpluginInputArgs } from '../../../../../../FlowPluginsTs/FlowHelpers/1.0.0/interfaces/interfaces';

const sampleH264 = require('../../../../../sampleData/media/sampleH264_1.json');

describe('ffmpegCommandMergeAudioTracks Plugin', () => {
  let baseArgs: IpluginInputArgs;
  let mockSpawn: jest.Mock;
  let mockFFprobeProcess: {
    stdout: { on: jest.Mock },
    stderr: { on: jest.Mock },
    on: jest.Mock,
  };

  beforeEach(() => {
    // Set up mock for spawn (used by FFprobe)
    mockFFprobeProcess = {
      stdout: {
        on: jest.fn(),
      },
      stderr: {
        on: jest.fn(),
      },
      on: jest.fn(),
    };

    mockSpawn = jest.fn(() => mockFFprobeProcess);

    baseArgs = {
      inputs: {
        secondFilePath: '/test/video2.mkv',
        directory: '',
        includeDuplicates: 'false',
      },
      variables: {
        ffmpegCommand: {
          init: true,
          shouldProcess: false,
          inputFiles: [],
          streams: JSON.parse(JSON.stringify(sampleH264.ffProbeData.streams.map(
            (stream: Record<string, unknown>, index: number) => ({
              ...stream,
              removed: false,
              forceEncoding: false,
              index,
              mapArgs: ['-map', `0:${index}`],
              inputArgs: [],
              outputArgs: [],
            }),
          ))),
          container: 'mkv',
          hardwareDecoding: false,
          overallInputArguments: [],
          overallOuputArguments: [],
        },
      } as IpluginInputArgs['variables'],
      inputFileObj: JSON.parse(JSON.stringify(sampleH264)),
      jobLog: jest.fn(),
      ffmpegPath: '/usr/bin/ffmpeg',
      deps: {
        require: (moduleName: string) => {
          if (moduleName === 'child_process') {
            return {
              spawn: mockSpawn,
            };
          }
          return {};
        },
        fsextra: {
          pathExistsSync: jest.fn(() => true),
        },
      },
    } as Partial<IpluginInputArgs> as IpluginInputArgs;

    // Mock fileExists to return true by default
    jest.mock('../../../../../../FlowPluginsTs/FlowHelpers/1.0.0/fileUtils', () => ({
      ...jest.requireActual('../../../../../../FlowPluginsTs/FlowHelpers/1.0.0/fileUtils'),
      fileExists: jest.fn(() => Promise.resolve(true)),
    }));
  });

  const setupFFprobeMock = (streams: unknown[]) => {
    const ffprobeOutput = JSON.stringify({
      streams,
    });

    mockFFprobeProcess.stdout.on.mockImplementation((event: string, callback: (data: Buffer) => void) => {
      if (event === 'data') {
        callback(Buffer.from(ffprobeOutput));
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mockFFprobeProcess.stderr.on.mockImplementation(() => {});

    mockFFprobeProcess.on.mockImplementation((event: string, callback: (code: number) => void) => {
      if (event === 'close') {
        callback(0);
      }
    });
  };

  describe('Basic Merging', () => {
    it('should add audio tracks from second file with no duplicate languages', async () => {
      // Second file has Russian audio
      setupFFprobeMock([
        {
          index: 0,
          codec_name: 'h264',
          codec_type: 'video',
          tags: { language: 'und' },
        },
        {
          index: 1,
          codec_name: 'aac',
          codec_type: 'audio',
          channels: 2,
          tags: { language: 'rus' },
        },
      ]);

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(baseArgs.variables.ffmpegCommand.shouldProcess).toBe(true);
      expect(baseArgs.variables.ffmpegCommand.inputFiles).toHaveLength(1);
      expect(baseArgs.variables.ffmpegCommand.inputFiles[0]).toBe('/test/video2.mkv');

      const audioStreams = baseArgs.variables.ffmpegCommand.streams.filter(
        (stream: unknown) => (stream as { codec_type: string }).codec_type === 'audio',
      );

      expect(audioStreams).toHaveLength(2); // Original + Russian from second file
      expect(baseArgs.jobLog).toHaveBeenCalledWith(expect.stringContaining('Added 1 audio track(s) from second file'));
    });

    it('should skip duplicate language tracks by default', async () => {
      // Second file has English audio (same as first file which has 'und')
      // First file has 'und' language, second file has 'und'
      setupFFprobeMock([
        {
          index: 0,
          codec_name: 'h264',
          codec_type: 'video',
          tags: { language: 'und' },
        },
        {
          index: 1,
          codec_name: 'aac',
          codec_type: 'audio',
          channels: 2,
          tags: { language: 'und' },
        },
      ]);

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(baseArgs.variables.ffmpegCommand.shouldProcess).toBe(false); // No processing needed

      const audioStreams = baseArgs.variables.ffmpegCommand.streams.filter(
        (stream: unknown) => (stream as { codec_type: string }).codec_type === 'audio',
      );

      expect(audioStreams).toHaveLength(1); // Only original audio
      expect(baseArgs.jobLog).toHaveBeenCalledWith(expect.stringContaining('Skipped 1 duplicate audio track(s)'));
    });

    it('should include duplicate language tracks when includeDuplicates is true', async () => {
      baseArgs.inputs.includeDuplicates = 'true';

      setupFFprobeMock([
        {
          index: 0,
          codec_name: 'h264',
          codec_type: 'video',
          tags: { language: 'und' },
        },
        {
          index: 1,
          codec_name: 'aac',
          codec_type: 'audio',
          channels: 2,
          tags: { language: 'und' },
        },
      ]);

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(baseArgs.variables.ffmpegCommand.shouldProcess).toBe(true);

      const audioStreams = baseArgs.variables.ffmpegCommand.streams.filter(
        (stream: unknown) => (stream as { codec_type: string }).codec_type === 'audio',
      );

      expect(audioStreams).toHaveLength(2); // Both audio tracks
      expect(baseArgs.jobLog).toHaveBeenCalledWith(expect.stringContaining('Added 1 audio track(s) from second file'));
    });
  });

  describe('Multiple Audio Tracks', () => {
    it('should handle second file with multiple audio tracks', async () => {
      setupFFprobeMock([
        {
          index: 0,
          codec_name: 'h264',
          codec_type: 'video',
          tags: { language: 'und' },
        },
        {
          index: 1,
          codec_name: 'aac',
          codec_type: 'audio',
          channels: 2,
          tags: { language: 'rus' },
        },
        {
          index: 2,
          codec_name: 'ac3',
          codec_type: 'audio',
          channels: 6,
          tags: { language: 'spa' },
        },
        {
          index: 3,
          codec_name: 'aac',
          codec_type: 'audio',
          channels: 2,
          tags: { language: 'fra' },
        },
      ]);

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(baseArgs.variables.ffmpegCommand.shouldProcess).toBe(true);

      const audioStreams = baseArgs.variables.ffmpegCommand.streams.filter(
        (stream: unknown) => (stream as { codec_type: string }).codec_type === 'audio',
      );

      // Original 1 + 3 new tracks
      expect(audioStreams).toHaveLength(4);
      expect(baseArgs.jobLog).toHaveBeenCalledWith(expect.stringContaining('Added 3 audio track(s) from second file'));
    });

    it('should correctly handle mixed duplicate and non-duplicate tracks', async () => {
      // Modify first file to have English audio
      baseArgs.variables.ffmpegCommand.streams[1].tags = { language: 'eng' };

      setupFFprobeMock([
        {
          index: 0,
          codec_name: 'h264',
          codec_type: 'video',
          tags: { language: 'und' },
        },
        {
          index: 1,
          codec_name: 'aac',
          codec_type: 'audio',
          channels: 2,
          tags: { language: 'eng' }, // Duplicate
        },
        {
          index: 2,
          codec_name: 'aac',
          codec_type: 'audio',
          channels: 2,
          tags: { language: 'rus' }, // Not duplicate
        },
      ]);

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(baseArgs.variables.ffmpegCommand.shouldProcess).toBe(true);

      const audioStreams = baseArgs.variables.ffmpegCommand.streams.filter(
        (stream: unknown) => (stream as { codec_type: string }).codec_type === 'audio',
      );

      expect(audioStreams).toHaveLength(2); // Original English + Russian
      expect(baseArgs.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('Skipping duplicate audio track from second file: eng'),
      );
      expect(baseArgs.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('Adding audio track from second file: rus'),
      );
    });
  });

  describe('Language Tag Handling', () => {
    it('should handle undefined language tags', async () => {
      setupFFprobeMock([
        {
          index: 0,
          codec_name: 'h264',
          codec_type: 'video',
        },
        {
          index: 1,
          codec_name: 'aac',
          codec_type: 'audio',
          channels: 2,
          // No tags at all
        },
      ]);

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      // Should be treated as 'und' and skipped as duplicate
      expect(baseArgs.variables.ffmpegCommand.shouldProcess).toBe(false);

      const audioStreams = baseArgs.variables.ffmpegCommand.streams.filter(
        (stream: unknown) => (stream as { codec_type: string }).codec_type === 'audio',
      );

      expect(audioStreams).toHaveLength(1); // Only original
    });

    it('should handle case-insensitive language matching', async () => {
      baseArgs.variables.ffmpegCommand.streams[1].tags = { language: 'ENG' };

      setupFFprobeMock([
        {
          index: 0,
          codec_name: 'h264',
          codec_type: 'video',
        },
        {
          index: 1,
          codec_name: 'aac',
          codec_type: 'audio',
          channels: 2,
          tags: { language: 'eng' },
        },
      ]);

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(baseArgs.variables.ffmpegCommand.shouldProcess).toBe(false); // Should skip as duplicate

      const audioStreams = baseArgs.variables.ffmpegCommand.streams.filter(
        (stream: unknown) => (stream as { codec_type: string }).codec_type === 'audio',
      );

      expect(audioStreams).toHaveLength(1); // Only original
    });
  });

  describe('Edge Cases', () => {
    it('should throw error when second file path is empty', async () => {
      baseArgs.inputs.secondFilePath = '';

      await expect(plugin(baseArgs)).rejects.toThrow('Second file path is required');
    });

    it('should handle second file with no audio streams', async () => {
      setupFFprobeMock([
        {
          index: 0,
          codec_name: 'h264',
          codec_type: 'video',
          tags: { language: 'und' },
        },
      ]);

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(baseArgs.variables.ffmpegCommand.shouldProcess).toBe(false);

      const audioStreams = baseArgs.variables.ffmpegCommand.streams.filter(
        (stream: unknown) => (stream as { codec_type: string }).codec_type === 'audio',
      );

      expect(audioStreams).toHaveLength(1); // Only original
      expect(baseArgs.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('No new audio tracks added from second file'),
      );
    });

    it('should handle second file with only video stream', async () => {
      setupFFprobeMock([
        {
          index: 0,
          codec_name: 'h264',
          codec_type: 'video',
          tags: { language: 'und' },
        },
      ]);

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(baseArgs.jobLog).toHaveBeenCalledWith(expect.stringContaining('Skipping video stream from second file'));
    });

    it('should correctly set map args for second file streams', async () => {
      setupFFprobeMock([
        {
          index: 0,
          codec_name: 'h264',
          codec_type: 'video',
        },
        {
          index: 1,
          codec_name: 'aac',
          codec_type: 'audio',
          channels: 2,
          tags: { language: 'rus' },
        },
      ]);

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);

      const audioStreams = baseArgs.variables.ffmpegCommand.streams.filter(
        (stream: unknown) => (stream as { codec_type: string; mapArgs: string[] }).codec_type === 'audio',
      );

      // Check that the second audio stream (from second file) has correct mapArgs
      const secondFileStream = audioStreams[1];
      expect(secondFileStream.mapArgs).toEqual(['-map', '1:1']);
    });
  });

  describe('File Path Templating', () => {
    it('should resolve templating variables in file path', async () => {
      // eslint-disable-next-line no-template-curly-in-string
      baseArgs.inputs.secondFilePath = '${fileName}_alt.${container}';
      baseArgs.inputs.directory = '/test/dir';

      setupFFprobeMock([
        {
          index: 0,
          codec_name: 'h264',
          codec_type: 'video',
        },
        {
          index: 1,
          codec_name: 'aac',
          codec_type: 'audio',
          channels: 2,
          tags: { language: 'rus' },
        },
      ]);

      await plugin(baseArgs);

      expect(mockSpawn).toHaveBeenCalled();
      const ffprobeArgs = mockSpawn.mock.calls[0][1];
      expect(ffprobeArgs[ffprobeArgs.length - 1]).toBe('/test/dir/SampleVideo_1280x720_1mb_alt.mp4');
    });

    it('should use input file directory when directory is not specified', async () => {
      baseArgs.inputs.secondFilePath = 'video2.mkv';
      baseArgs.inputs.directory = '';

      setupFFprobeMock([
        {
          index: 0,
          codec_name: 'h264',
          codec_type: 'video',
        },
        {
          index: 1,
          codec_name: 'aac',
          codec_type: 'audio',
          channels: 2,
          tags: { language: 'rus' },
        },
      ]);

      await plugin(baseArgs);

      expect(mockSpawn).toHaveBeenCalled();
      const ffprobeArgs = mockSpawn.mock.calls[0][1];
      expect(ffprobeArgs[ffprobeArgs.length - 1]).toBe('C:/Transcode/Source Folder/video2.mkv');
    });
  });

  describe('FFprobe Error Handling', () => {
    it('should throw error when FFprobe fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      mockFFprobeProcess.stdout.on.mockImplementation(() => {});
      mockFFprobeProcess.stderr.on.mockImplementation((event: string, callback: (data: Buffer) => void) => {
        if (event === 'data') {
          callback(Buffer.from('FFprobe error'));
        }
      });
      mockFFprobeProcess.on.mockImplementation((event: string, callback: (code: number) => void) => {
        if (event === 'close') {
          callback(1); // Non-zero exit code
        }
      });

      await expect(plugin(baseArgs)).rejects.toThrow('FFprobe failed with code 1');
    });

    it('should throw error when FFprobe output is invalid JSON', async () => {
      mockFFprobeProcess.stdout.on.mockImplementation((event: string, callback: (data: Buffer) => void) => {
        if (event === 'data') {
          callback(Buffer.from('invalid json'));
        }
      });
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      mockFFprobeProcess.stderr.on.mockImplementation(() => {});
      mockFFprobeProcess.on.mockImplementation((event: string, callback: (code: number) => void) => {
        if (event === 'close') {
          callback(0);
        }
      });

      await expect(plugin(baseArgs)).rejects.toThrow(/Failed to parse FFprobe output/);
    });
  });
});
