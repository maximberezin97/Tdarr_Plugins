/* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */
const details = () => ({
  id: 'Tdarr_Plugin_maxb_ffmpegCommandMergeAudioTracks',
  Stage: 'Pre-processing',
  Name: 'Merge Audio Tracks',
  Type: 'Video',
  Operation: 'Transcode',
  Description: 'Merge audio tracks from multiple video files into the current file. '
    + 'Keeps video from the first file and combines audio tracks, removing duplicates by language.',
  Version: '1.0.0',
  Tags: 'pre-processing,ffmpeg,audio,configurable',
  Inputs: [
    {
      name: 'secondFilePath',
      type: 'string',
      defaultValue: '',
      inputUI: {
        type: 'text',
      },
      tooltip: 'Specify the path to the second video file to merge audio from. '
        + 'Supports templating: ${fileName}_alternate.${container} '
        + 'Example: ${fileName}_jp.${container}',
    },
    {
      name: 'directory',
      type: 'string',
      defaultValue: '',
      inputUI: {
        type: 'text',
      },
      tooltip: 'Specify directory containing the second file. Leave blank to use the same directory as the input file.',
    },
    {
      name: 'includeDuplicates',
      type: 'boolean',
      defaultValue: false,
      inputUI: {
        type: 'dropdown',
        options: [
          'false',
          'true',
        ],
      },
      tooltip: 'If enabled, includes audio tracks even if their language already exists in the first file. '
        + 'If disabled, audio tracks with duplicate languages are skipped.',
    },
  ],
});

/**
 * Get language tag from stream, normalizing undefined/empty to 'und'
 */
const getLanguageTag = (stream) => {
  const lang = stream?.tags?.language;
  if (!lang || lang === 'und' || lang === '') {
    return 'und';
  }
  return lang.toLowerCase();
};

/**
 * Run ffprobe to get stream information from a file
 */
const runFFprobe = (filePath, ffprobePath) => {
  const { spawnSync } = require('child_process');

  const ffprobeArgs = [
    '-v',
    'quiet',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ];

  const result = spawnSync(ffprobePath, ffprobeArgs, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
  });

  if (result.error) {
    throw new Error(`FFprobe process error: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`FFprobe failed with code ${result.status}: ${result.stderr}`);
  }

  try {
    const data = JSON.parse(result.stdout);
    return data;
  } catch (err) {
    throw new Error(`Failed to parse FFprobe output: ${err.message}`);
  }
};

/**
 * Get file name without extension
 */
const getFileName = (filePath) => {
  const path = require('path');
  const basename = path.basename(filePath);
  const lastDot = basename.lastIndexOf('.');
  return lastDot > 0 ? basename.substring(0, lastDot) : basename;
};

/**
 * Get file extension/container
 */
const getContainer = (filePath) => {
  const path = require('path');
  const ext = path.extname(filePath);
  return ext ? ext.substring(1) : '';
};

/**
 * Get directory path
 */
const getDirectory = (filePath) => {
  const path = require('path');
  return path.dirname(filePath);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const plugin = (file, librarySettings, inputs, otherArguments) => {
  const lib = require('../methods/lib')();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-param-reassign
  inputs = lib.loadDefaultValues(inputs, details);

  const response = {
    processFile: false,
    preset: '',
    container: `.${file.container}`,
    handBrakeMode: false,
    FFmpegMode: true,
    reQueueAfter: true,
    infoLog: '',
  };

  // Check if file is a video
  if (file.fileMedium !== 'video') {
    response.infoLog += '☒File is not video\n';
    response.processFile = false;
    return response;
  }

  // Check if secondFilePath is configured
  if (!inputs.secondFilePath || inputs.secondFilePath.trim() === '') {
    response.infoLog += '☒Second file path not set, please configure required options. Skipping this plugin.\n';
    response.processFile = false;
    return response;
  }

  const fs = require('fs');
  const path = require('path');

  try {
    const includeDuplicates = inputs.includeDuplicates === true || inputs.includeDuplicates === 'true';
    let secondFilePath = String(inputs.secondFilePath).trim();
    const directory = inputs.directory?.trim() || getDirectory(file._id);

    // Apply templating to second file path
    const fileName = getFileName(file._id);
    const container = getContainer(file._id);

    secondFilePath = secondFilePath.replace(/\$\{fileName\}/g, fileName);
    secondFilePath = secondFilePath.replace(/\$\{container\}/g, container);

    // If path is not absolute, prepend directory
    if (!path.isAbsolute(secondFilePath)) {
      secondFilePath = path.join(directory, secondFilePath);
    }

    response.infoLog += `☑Second file path resolved to: ${secondFilePath}\n`;

    // Check if second file exists
    if (!fs.existsSync(secondFilePath)) {
      response.infoLog += `☒Second file does not exist: ${secondFilePath}\n`;
      response.processFile = false;
      return response;
    }

    // Get ffprobe path from otherArguments
    const ffprobePath = otherArguments.ffmpegPath.replace('ffmpeg', 'ffprobe');

    // Run ffprobe on both files
    response.infoLog += '☑Running FFprobe on first file...\n';
    const firstFileProbe = runFFprobe(file._id, ffprobePath);

    response.infoLog += '☑Running FFprobe on second file...\n';
    const secondFileProbe = runFFprobe(secondFilePath, ffprobePath);

    // Build language map from first file's audio streams
    const firstFileLanguages = new Set();
    firstFileProbe.streams.forEach((stream) => {
      if (stream.codec_type === 'audio') {
        const lang = getLanguageTag(stream);
        firstFileLanguages.add(lang);
        response.infoLog += `☑First file has audio track in language: ${lang}\n`;
      }
    });

    // Filter audio streams from second file
    const audioStreamsToAdd = [];
    secondFileProbe.streams.forEach((stream) => {
      if (stream.codec_type !== 'audio') {
        return;
      }

      const lang = getLanguageTag(stream);
      const shouldSkip = !includeDuplicates && firstFileLanguages.has(lang);

      if (shouldSkip) {
        response.infoLog += `☒Skipping duplicate audio track from second file: ${lang} (stream ${stream.index})\n`;
      } else {
        response.infoLog += `☑Adding audio track from second file: ${lang} (stream ${stream.index})\n`;
        audioStreamsToAdd.push(stream);

        // Add language to set to prevent further duplicates
        if (!includeDuplicates) {
          firstFileLanguages.add(lang);
        }
      }
    });

    if (audioStreamsToAdd.length === 0) {
      response.infoLog += '☒No new audio tracks to add from second file\n';
      response.processFile = false;
      return response;
    }

    // Build FFmpeg command
    // Format: -i file1 -i file2 -map 0:v -map 0:a -map 1:a:0 -map 1:a:1 ... -c copy
    let ffmpegCommand = '';

    // Add second file as input
    ffmpegCommand += `-i "${secondFilePath}" `;

    // Map all streams from first file
    ffmpegCommand += '-map 0 ';

    // Map audio streams from second file
    audioStreamsToAdd.forEach((stream) => {
      ffmpegCommand += `-map 1:${stream.index} `;
    });

    // Copy all codecs
    ffmpegCommand += '-c copy ';

    // Set max muxing queue size to prevent issues
    ffmpegCommand += '-max_muxing_queue_size 9999';

    response.preset = ffmpegCommand;
    response.processFile = true;
    response.infoLog += `☑Added ${audioStreamsToAdd.length} audio track(s) from second file\n`;

    return response;
  } catch (err) {
    response.infoLog += `☒Error: ${err.message}\n`;
    response.processFile = false;
    return response;
  }
};

module.exports.details = details;
module.exports.plugin = plugin;
