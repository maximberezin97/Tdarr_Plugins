"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.plugin = exports.details = void 0;
var flowUtils_1 = require("../../../../FlowHelpers/1.0.0/interfaces/flowUtils");
var fileUtils_1 = require("../../../../FlowHelpers/1.0.0/fileUtils");
var details = function () { return ({
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
}); };
exports.details = details;
var getLanguageTag = function (stream) {
    var _a;
    var lang = (_a = stream === null || stream === void 0 ? void 0 : stream.tags) === null || _a === void 0 ? void 0 : _a.language;
    if (!lang || lang === 'und' || lang === '') {
        return 'und';
    }
    return lang.toLowerCase();
};
// Run ffprobe to get stream information from a file
var runFFprobe = function (args, filePath) { return __awaiter(void 0, void 0, void 0, function () {
    var spawn;
    return __generator(this, function (_a) {
        spawn = require('child_process').spawn;
        return [2 /*return*/, new Promise(function (resolve, reject) {
                var ffprobeArgs = [
                    '-v',
                    'quiet',
                    '-print_format',
                    'json',
                    '-show_format',
                    '-show_streams',
                    filePath,
                ];
                args.jobLog("Running FFprobe on: ".concat(filePath));
                args.jobLog("FFprobe command: ".concat(args.ffmpegPath.replace('ffmpeg', 'ffprobe'), " ").concat(ffprobeArgs.join(' ')));
                var ffprobeProcess = spawn(args.ffmpegPath.replace('ffmpeg', 'ffprobe'), ffprobeArgs);
                var stdout = '';
                var stderr = '';
                ffprobeProcess.stdout.on('data', function (data) {
                    stdout += data.toString();
                });
                ffprobeProcess.stderr.on('data', function (data) {
                    stderr += data.toString();
                });
                ffprobeProcess.on('close', function (code) {
                    if (code !== 0) {
                        args.jobLog("FFprobe failed with code ".concat(code));
                        args.jobLog("FFprobe stderr: ".concat(stderr));
                        reject(new Error("FFprobe failed with code ".concat(code)));
                        return;
                    }
                    try {
                        var data = JSON.parse(stdout);
                        args.jobLog("FFprobe found ".concat(data.streams.length, " streams in ").concat(filePath));
                        resolve(data);
                    }
                    catch (err) {
                        args.jobLog("Failed to parse FFprobe output: ".concat(err));
                        reject(new Error("Failed to parse FFprobe output: ".concat(err)));
                    }
                });
                ffprobeProcess.on('error', function (err) {
                    args.jobLog("FFprobe process error: ".concat(err.message));
                    reject(err);
                });
            })];
    });
}); };
var plugin = function (args) { return __awaiter(void 0, void 0, void 0, function () {
    var lib, includeDuplicates, secondFilePath, directory, fileName, container, secondFileProbe, secondFileInputIndex, streams, firstFileLanguages, addedCount, skippedCount;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                lib = require('../../../../../methods/lib')();
                // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-param-reassign
                args.inputs = lib.loadDefaultValues(args.inputs, details);
                (0, flowUtils_1.checkFfmpegCommandInit)(args);
                includeDuplicates = Boolean(args.inputs.includeDuplicates);
                secondFilePath = String(args.inputs.secondFilePath).trim();
                directory = String(args.inputs.directory).trim()
                    || (0, fileUtils_1.getFileAbosluteDir)(args.inputFileObj._id);
                // Apply templating to second file path
                if (secondFilePath === '') {
                    throw new Error('Second file path is required');
                }
                fileName = (0, fileUtils_1.getFileName)(args.inputFileObj._id);
                container = (0, fileUtils_1.getContainer)(args.inputFileObj._id);
                // eslint-disable-next-line no-template-curly-in-string
                secondFilePath = secondFilePath.replace(/\${fileName}/g, fileName);
                // eslint-disable-next-line no-template-curly-in-string
                secondFilePath = secondFilePath.replace(/\${container}/g, container);
                // If path is not absolute, prepend directory
                if (!secondFilePath.startsWith('/')) {
                    secondFilePath = "".concat(directory, "/").concat(secondFilePath);
                }
                args.jobLog("Second file path resolved to: ".concat(secondFilePath));
                return [4 /*yield*/, (0, fileUtils_1.fileExists)(secondFilePath)];
            case 1:
                // Check if second file exists
                if (!(_a.sent())) {
                    throw new Error("Second file does not exist: ".concat(secondFilePath));
                }
                return [4 /*yield*/, runFFprobe(args, secondFilePath)];
            case 2:
                secondFileProbe = _a.sent();
                // Add second file to input files
                args.variables.ffmpegCommand.inputFiles.push(secondFilePath);
                secondFileInputIndex = args.variables.ffmpegCommand.inputFiles.length;
                streams = args.variables.ffmpegCommand.streams;
                firstFileLanguages = new Set();
                streams.forEach(function (stream) {
                    if (stream.codec_type === 'audio' && !stream.removed) {
                        var lang = getLanguageTag(stream);
                        firstFileLanguages.add(lang);
                        args.jobLog("First file has audio track in language: ".concat(lang));
                    }
                });
                // Remove all video streams from second file (keep only first file's video)
                secondFileProbe.streams.forEach(function (stream) {
                    if (stream.codec_type === 'video') {
                        args.jobLog("Skipping video stream from second file (index ".concat(stream.index, ")"));
                    }
                });
                addedCount = 0;
                skippedCount = 0;
                secondFileProbe.streams.forEach(function (stream) {
                    if (stream.codec_type !== 'audio') {
                        return;
                    }
                    var lang = getLanguageTag(stream);
                    var shouldSkip = !includeDuplicates && firstFileLanguages.has(lang);
                    if (shouldSkip) {
                        args.jobLog("Skipping duplicate audio track from second file: ".concat(lang, " (stream ").concat(stream.index, ")"));
                        skippedCount += 1;
                    }
                    else {
                        args.jobLog("Adding audio track from second file: ".concat(lang, " (stream ").concat(stream.index, ")"));
                        // Create a new stream entry for this audio track
                        var newStream = __assign(__assign({}, stream), { removed: false, forceEncoding: false, index: streams.length, mapArgs: [
                                '-map',
                                "".concat(secondFileInputIndex, ":").concat(stream.index),
                            ], inputArgs: [], outputArgs: [
                                "-c:a:".concat(streams.filter(function (s) { return s.codec_type === 'audio' && !s.removed; }).length),
                                'copy',
                            ] });
                        streams.push(newStream);
                        addedCount += 1;
                        // Add language to set if not a duplicate
                        if (!includeDuplicates) {
                            firstFileLanguages.add(lang);
                        }
                    }
                });
                if (addedCount > 0) {
                    args.jobLog("Added ".concat(addedCount, " audio track(s) from second file"));
                    args.jobLog("Skipped ".concat(skippedCount, " duplicate audio track(s)"));
                    // eslint-disable-next-line no-param-reassign
                    args.variables.ffmpegCommand.shouldProcess = true;
                }
                else {
                    args.jobLog('No new audio tracks added from second file');
                }
                return [2 /*return*/, {
                        outputFileObj: args.inputFileObj,
                        outputNumber: 1,
                        variables: args.variables,
                    }];
        }
    });
}); };
exports.plugin = plugin;
