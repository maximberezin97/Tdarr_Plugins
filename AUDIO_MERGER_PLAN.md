# Audio Merger Plugin Implementation Plan

## Overview
Create a Tdarr Flow Plugin that merges audio tracks from multiple video files into a single output file. The plugin will keep the video stream from the first file and intelligently combine audio tracks from all input files, removing duplicates based on language tags.

## Research Summary

### Tdarr Plugin Architecture
- **Plugin Type**: Flow Plugin (TypeScript)
- **Location**: `FlowPluginsTs/CommunityFlowPlugins/ffmpegCommand/`
- **Structure**: Each plugin exports:
  - `details()`: Returns plugin metadata (name, description, inputs, outputs, etc.)
  - `plugin()`: Main logic that processes the file

### Key Interfaces
- `IpluginInputArgs`: Contains inputs, variables, inputFileObj, jobLog, etc.
- `IpluginOutputArgs`: Returns outputNumber, outputFileObj, variables
- `IffmpegCommand`: Manages FFmpeg command building with streams array
- `IffmpegCommandStream`: Extended stream with `removed`, `mapArgs`, `inputArgs`, `outputArgs`

### FFmpeg Command Flow
1. `ffmpegCommandStart`: Initializes the FFmpeg command structure
2. Various plugins modify streams (add, remove, configure)
3. `ffmpegCommandExecute`: Builds and executes the final FFmpeg command

### Multiple Input Files
- FFmpeg commands support multiple inputs via `inputFiles` array
- Streams from additional inputs are mapped using `-map 1:a:0` syntax
- Each stream has `mapArgs` that define which input and stream index to use

## Implementation Plan

### Plugin Details
- **Name**: Merge Audio Tracks
- **Category**: ffmpegCommand
- **Version**: 1.0.0
- **Description**: Merge audio tracks from multiple video files, keeping the first file's video and combining audio tracks while removing duplicates by language

### Inputs
1. **Second Video File Path** (required)
   - Type: string
   - Input UI: text or directory picker
   - Supports templating like `${fileName}_alternate.mkv`

2. **Additional Video Files** (optional, if trivial to implement)
   - Type: string (comma-separated paths)
   - For handling 3+ input files

3. **Language Priority**
   - Type: string
   - Default: "first"
   - Options: "first" (prefer first file), "last" (prefer last file)
   - Determines which audio track to keep when languages match

4. **Include All Duplicates**
   - Type: boolean
   - Default: false
   - If true, keeps all audio tracks even if languages match

### Plugin Logic

#### Step 1: Initialize FFmpeg Command
- Check that `ffmpegCommandStart` has been called
- Verify `args.variables.ffmpegCommand.init === true`

#### Step 2: Load Second File
- Resolve second file path using templating
- Check file exists using `fileExists()`
- Load FFprobe data for second file
- Add second file to `args.variables.ffmpegCommand.inputFiles`

#### Step 3: Process Video Streams
- Keep only the first file's video stream
- Remove all video streams from second file
- Mark video streams from file 2+ as `removed: true`

#### Step 4: Process Audio Streams
- Extract all audio streams from first file (keep all)
- Extract all audio streams from second file
- Build language map from first file's audio streams
- For each audio stream in second file:
  - Check if language tag exists in first file
  - If language exists and `Include All Duplicates` is false: skip (remove)
  - If language doesn't exist or duplicates allowed: add stream
  - Update `mapArgs` to reference correct input file (e.g., `-map 1:a:0`)

#### Step 5: Update Stream Indices
- Recalculate stream indices for proper ordering
- Ensure `mapArgs` correctly reference input file and stream
- Set `shouldProcess: true` to trigger encoding

### Example FFmpeg Command
```bash
ffmpeg -i video1.mkv -i video2.mkv \
  -map 0:v:0 \                    # Video from first file
  -c:v:0 copy \                   # Copy video codec
  -map 0:a:0 \                    # English from first file
  -c:a:0 copy \
  -map 0:a:1 \                    # English (SDH) from first file
  -c:a:1 copy \
  -map 0:a:2 \                    # Spanish from first file
  -c:a:2 copy \
  -map 1:a:0 \                    # Russian from second file
  -c:a:3 copy \
  output.mkv
```

### Testing Strategy

#### Unit Tests
1. **Basic Merge**: Two files with non-overlapping languages
2. **Duplicate Removal**: Two files with same language (English) - should prefer first
3. **Multiple Duplicates**: Complex scenario with multiple overlapping languages
4. **Edge Cases**:
   - Second file doesn't exist
   - Second file has no audio streams
   - First file has no audio streams
   - Undefined language tags
   - Case-insensitive language matching
5. **Include All Duplicates**: Test with flag enabled

#### Integration Tests
- Will be tested in live Tdarr instance with real media files

### File Structure
```
FlowPluginsTs/CommunityFlowPlugins/ffmpegCommand/ffmpegCommandMergeAudioTracks/
└── 1.0.0/
    └── index.ts

tests/FlowPlugins/CommunityFlowPlugins/ffmpegCommand/ffmpegCommandMergeAudioTracks/
└── 1.0.0/
    └── index.test.ts
```

### Dependencies
- `../../../../FlowHelpers/1.0.0/fileUtils` - File operations
- `../../../../FlowHelpers/1.0.0/interfaces/interfaces` - Type definitions
- `../../../../FlowHelpers/1.0.0/interfaces/flowUtils` - FFmpeg command utilities

### Development Workflow
1. ✓ Research plugin architecture and patterns
2. ✓ Create implementation plan
3. Implement plugin (index.ts)
4. Write comprehensive test suite (index.test.ts)
5. Compile TypeScript with `tsc`
6. Run `npm run lint:fix` and address issues
7. Run `npm run checkPlugins` and address issues
8. Run `npm run test` and ensure all tests pass
9. Create git commit
10. Deploy to test Tdarr instance
11. Iterate based on feedback

### Potential Challenges
1. **FFprobe Data Loading**: Need to load FFprobe data for additional files
   - May need to use `args.deps` to access FFprobe functionality
   - Or read existing cached FFprobe data if available

2. **Stream Index Management**: Ensuring correct mapping between input files and output streams
   - Need to carefully track which input file each stream comes from
   - mapArgs format: `-map <input_index>:<stream_type>:<stream_type_index>`

3. **Language Matching**: Handling various language tag formats
   - Normalize to lowercase for comparison
   - Handle undefined/missing language tags
   - Support ISO 639-1 and ISO 639-2 codes

4. **Container Compatibility**: Different containers support different codecs
   - Ensure output container (mkv recommended) supports all audio codecs
   - May need to warn if incompatible combinations detected

### Success Criteria
- Plugin compiles without errors
- All tests pass
- ESLint passes with no errors
- checkPlugins passes with no errors
- Successfully merges audio tracks in live Tdarr instance
- Correctly removes duplicate language tracks
- Preserves video stream from first file
- Output file is playable and contains expected streams
