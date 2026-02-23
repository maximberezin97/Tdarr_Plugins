/* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */
import {
  IffmpegCommandStream,
  IpluginDetails,
  IpluginInputArgs,
  IpluginOutputArgs,
} from '../../../../FlowHelpers/1.0.0/interfaces/interfaces';
import { checkFfmpegCommandInit } from '../../../../FlowHelpers/1.0.0/interfaces/flowUtils';
import {
  fileExists, getContainer, getFileAbosluteDir, getFileName,
} from '../../../../FlowHelpers/1.0.0/fileUtils';
import { Istreams } from '../../../../FlowHelpers/1.0.0/interfaces/synced/IFileObject';

const details = (): IpluginDetails => ({
  name: 'Merge Audio Tracks',
  description: 'Merge audio tracks from multiple video files into the current file. '
    + 'Keeps video from the first file and combines audio tracks, removing duplicates by language.',
  style: {
    borderColor: '#6efefc',
  },
  tags: 'video',
  isStartPlugin: false,
  pType: '',
  requiresVersion: '2.11.01',
  sidebarPosition: -1,
  icon: '',
  inputs: [
    {
      label: 'Second Video File Path',
      name: 'secondFilePath',
      type: 'string',
      // eslint-disable-next-line no-template-curly-in-string
      defaultValue: '',
      inputUI: {
        type: 'text',
      },
      tooltip: 'Specify the path to the second video file to merge audio from. '
        // eslint-disable-next-line no-template-curly-in-string
        + 'Supports templating: ${fileName}_alternate.${container}',
    },
    {
      label: 'Directory',
      name: 'directory',
      type: 'string',
      defaultValue: '',
      inputUI: {
        type: 'directory',
      },
      tooltip: 'Specify directory containing the second file. Leave blank to use the same directory as the input file.',
    },
    {
      label: 'Include Duplicate Languages',
      name: 'includeDuplicates',
      type: 'boolean',
      defaultValue: 'false',
      inputUI: {
        type: 'switch',
      },
      tooltip: 'If enabled, includes audio tracks even if their language already exists in the first file. '
        + 'If disabled, audio tracks with duplicate languages are skipped.',
    },
  ],
  outputs: [
    {
      number: 1,
      tooltip: 'Continue to next plugin',
    },
  ],
});

interface IffprobeOutput {
  streams: Istreams[];
}

const getLanguageTag = (stream: Istreams | IffmpegCommandStream): string => {
  const lang = stream?.tags?.language;
  if (!lang || lang === 'und' || lang === '') {
    return 'und';
  }
  return lang.toLowerCase();
};

// Run ffprobe to get stream information from a file
const runFFprobe = (
  args: IpluginInputArgs,
  filePath: string,
): Promise<IffprobeOutput> => {
  const { spawn } = require('child_process');

  return new Promise((resolve, reject) => {
    const ffprobeArgs = [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ];

    args.jobLog(`Running FFprobe on: ${filePath}`);
    args.jobLog(`FFprobe command: ${args.ffmpegPath.replace('ffmpeg', 'ffprobe')} ${ffprobeArgs.join(' ')}`);

    const ffprobeProcess = spawn(
      args.ffmpegPath.replace('ffmpeg', 'ffprobe'),
      ffprobeArgs,
    );

    let stdout = '';
    let stderr = '';

    ffprobeProcess.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    ffprobeProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    ffprobeProcess.on('close', (code: number) => {
      if (code !== 0) {
        args.jobLog(`FFprobe failed with code ${code}`);
        args.jobLog(`FFprobe stderr: ${stderr}`);
        reject(new Error(`FFprobe failed with code ${code}`));
        return;
      }

      try {
        const data = JSON.parse(stdout) as IffprobeOutput;
        args.jobLog(`FFprobe found ${data.streams.length} streams in ${filePath}`);
        resolve(data);
      } catch (err) {
        args.jobLog(`Failed to parse FFprobe output: ${err}`);
        reject(new Error(`Failed to parse FFprobe output: ${err}`));
      }
    });

    ffprobeProcess.on('error', (err: Error) => {
      args.jobLog(`FFprobe process error: ${err.message}`);
      reject(err);
    });
  });
};

const plugin = async (args: IpluginInputArgs): Promise<IpluginOutputArgs> => {
  const lib = require('../../../../../methods/lib')();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-param-reassign
  args.inputs = lib.loadDefaultValues(args.inputs, details);

  checkFfmpegCommandInit(args);

  const includeDuplicates = Boolean(args.inputs.includeDuplicates);
  let secondFilePath = String(args.inputs.secondFilePath).trim();
  const directory = String(args.inputs.directory).trim()
    || getFileAbosluteDir(args.inputFileObj._id);

  // Apply templating to second file path
  if (secondFilePath === '') {
    throw new Error('Second file path is required');
  }

  const fileName = getFileName(args.inputFileObj._id);
  const container = getContainer(args.inputFileObj._id);

  // eslint-disable-next-line no-template-curly-in-string
  secondFilePath = secondFilePath.replace(/\${fileName}/g, fileName);
  // eslint-disable-next-line no-template-curly-in-string
  secondFilePath = secondFilePath.replace(/\${container}/g, container);

  // If path is not absolute, prepend directory
  if (!secondFilePath.startsWith('/')) {
    secondFilePath = `${directory}/${secondFilePath}`;
  }

  args.jobLog(`Second file path resolved to: ${secondFilePath}`);

  // Check if second file exists
  if (!(await fileExists(secondFilePath))) {
    throw new Error(`Second file does not exist: ${secondFilePath}`);
  }

  // Get FFprobe data for second file
  const secondFileProbe = await runFFprobe(args, secondFilePath);

  // Add second file to input files
  args.variables.ffmpegCommand.inputFiles.push(secondFilePath);
  const secondFileInputIndex = args.variables.ffmpegCommand.inputFiles.length;

  // Get current streams from first file
  const { streams } = args.variables.ffmpegCommand;

  // Build language map from first file's audio streams
  const firstFileLanguages = new Set<string>();
  streams.forEach((stream) => {
    if (stream.codec_type === 'audio' && !stream.removed) {
      const lang = getLanguageTag(stream);
      firstFileLanguages.add(lang);
      args.jobLog(`First file has audio track in language: ${lang}`);
    }
  });

  // Remove all video streams from second file (keep only first file's video)
  secondFileProbe.streams.forEach((stream) => {
    if (stream.codec_type === 'video') {
      args.jobLog(`Skipping video stream from second file (index ${stream.index})`);
    }
  });

  // Process audio streams from second file
  let addedCount = 0;
  let skippedCount = 0;

  secondFileProbe.streams.forEach((stream) => {
    if (stream.codec_type !== 'audio') {
      return;
    }

    const lang = getLanguageTag(stream);
    const shouldSkip = !includeDuplicates && firstFileLanguages.has(lang);

    if (shouldSkip) {
      args.jobLog(`Skipping duplicate audio track from second file: ${lang} (stream ${stream.index})`);
      skippedCount += 1;
    } else {
      args.jobLog(`Adding audio track from second file: ${lang} (stream ${stream.index})`);

      // Create a new stream entry for this audio track
      const newStream: IffmpegCommandStream = {
        ...stream,
        removed: false,
        forceEncoding: false,
        index: streams.length,
        mapArgs: [
          '-map',
          `${secondFileInputIndex}:${stream.index}`,
        ],
        inputArgs: [],
        outputArgs: [
          `-c:a:${streams.filter((s) => s.codec_type === 'audio' && !s.removed).length}`,
          'copy',
        ],
      };

      streams.push(newStream);
      addedCount += 1;

      // Add language to set if not a duplicate
      if (!includeDuplicates) {
        firstFileLanguages.add(lang);
      }
    }
  });

  if (addedCount > 0) {
    args.jobLog(`Added ${addedCount} audio track(s) from second file`);
    args.jobLog(`Skipped ${skippedCount} duplicate audio track(s)`);
    // eslint-disable-next-line no-param-reassign
    args.variables.ffmpegCommand.shouldProcess = true;
  } else {
    args.jobLog('No new audio tracks added from second file');
  }

  return {
    outputFileObj: args.inputFileObj,
    outputNumber: 1,
    variables: args.variables,
  };
};

export {
  details,
  plugin,
};
