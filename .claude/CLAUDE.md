# Tdarr_Plugins Repository - Claude Memory

## Repository Overview

This is a fork of the official [Tdarr_Plugins](https://github.com/HaveAGitGat/Tdarr_Plugins) repository for developing custom Tdarr Flow plugins.

- **GitHub**: `maximberezin97/Tdarr_Plugins`
- **Branch**: `audio-merger` (custom development branch)
- **Main Branch**: `master`
- **Remote**: `git@github.com-personal:maximberezin97/Tdarr_Plugins.git` (uses personal SSH key)

## Git Configuration

### Repository-Level Config
```bash
git config user.name "Maxim Berezin"
git config user.email "mberezin@pm.me"
```

### SSH Setup
- **Personal GitHub SSH**: Uses `~/.ssh/id_ed25519` via `github.com-personal` alias
- **Work GitHub SSH**: Uses 1Password agent via `github.com` (for work account)

## Development Environment

### Required Tools
- **Node.js**: v25.2.1 (v16+ required per README)
- **npm**: 11.6.2
- **TypeScript**: 5.9.3 (installed via npm)

### Installation
```bash
npm install
```

### Available Scripts
```bash
npm run lint:fix        # Run ESLint with auto-fix
npm run checkPlugins    # Run custom plugin validation rules
npm run test            # Run all tests
npm run test:flows      # Run Flow plugin tests with Jest
tsc                     # Compile TypeScript to JavaScript
```

## Tdarr Plugin Architecture

### Plugin Types

1. **Classic Plugins** (Legacy)
   - Located in: `Community/Tdarr_Plugin_*.js`
   - Single JavaScript files
   - Can be run in plugin stacks or flows
   - No imports, self-contained

2. **Flow Plugins** (Modern - TypeScript)
   - Source: `FlowPluginsTs/CommunityFlowPlugins/`
   - Compiled: `FlowPlugins/CommunityFlowPlugins/`
   - More capabilities and features
   - Used exclusively in Tdarr Flows

### Flow Plugin Structure

```
FlowPluginsTs/CommunityFlowPlugins/
└── <category>/              # e.g., ffmpegCommand, file, audio, video, tools
    └── <pluginName>/        # e.g., ffmpegCommandMergeAudioTracks
        └── 1.0.0/           # Version number
            └── index.ts     # Plugin source code

tests/FlowPlugins/CommunityFlowPlugins/
└── <category>/
    └── <pluginName>/
        └── 1.0.0/
            └── index.test.ts  # Test suite
```

### Plugin Code Structure

Every Flow plugin exports two functions:

1. **`details()`** - Returns plugin metadata
   ```typescript
   const details = (): IpluginDetails => ({
     name: 'Plugin Name',
     description: 'What it does',
     style: { borderColor: '#6efefc' },
     tags: 'video',
     isStartPlugin: false,
     pType: '',
     requiresVersion: '2.11.01',
     sidebarPosition: -1,
     icon: '',
     inputs: [/* user input definitions */],
     outputs: [/* output port definitions */],
   });
   ```

2. **`plugin()`** - Main execution logic
   ```typescript
   const plugin = async (args: IpluginInputArgs): Promise<IpluginOutputArgs> => {
     // Plugin logic here
     return {
       outputFileObj: args.inputFileObj,
       outputNumber: 1,
       variables: args.variables,
     };
   };
   ```

### Key Interfaces

- `IpluginInputArgs` - Contains inputs, variables, inputFileObj, jobLog, dependencies
- `IpluginOutputArgs` - Returns outputNumber, outputFileObj, variables
- `IffmpegCommand` - Manages FFmpeg command building with streams array
- `IffmpegCommandStream` - Extended stream with removed, mapArgs, inputArgs, outputArgs

## Audio Track Merger Plugin

### Location
```
FlowPluginsTs/CommunityFlowPlugins/ffmpegCommand/ffmpegCommandMergeAudioTracks/1.0.0/index.ts
FlowPlugins/CommunityFlowPlugins/ffmpegCommand/ffmpegCommandMergeAudioTracks/1.0.0/index.js (compiled)
tests/FlowPlugins/CommunityFlowPlugins/ffmpegCommand/ffmpegCommandMergeAudioTracks/1.0.0/index.test.ts
```

### Purpose
Merges audio tracks from multiple video files into a single output file while:
- Keeping video stream from first file only
- Combining audio tracks from all input files
- Removing duplicate language tracks (configurable)

### Features
1. Uses FFprobe to analyze second file's stream information
2. Intelligent duplicate detection by language tag
3. Case-insensitive language matching
4. Supports file path templating (e.g., `${fileName}_alternate.${container}`)
5. Optional inclusion of duplicate language tracks

### Example Use Case
- **Input 1**: `video1.mkv` with audio: English, English (SDH), Spanish
- **Input 2**: `video2.mkv` with audio: Russian, English
- **Output**: `video3.mkv` with audio: English, English (SDH), Spanish, Russian
  - English from video2 is skipped (duplicate)

### Plugin Inputs
1. **Second Video File Path** (required, string)
   - Supports templating: `${fileName}`, `${container}`
2. **Directory** (optional, string)
   - Defaults to input file's directory
3. **Include Duplicate Languages** (boolean, default: false)
   - If true, keeps all audio tracks even if languages match

### Implementation Details
- Runs FFprobe as child process using Node's `child_process.spawn`
- Adds second file to `ffmpegCommand.inputFiles` array
- Modifies stream `mapArgs` to reference correct input file (e.g., `-map 1:a:0`)
- Marks video streams from additional files as skipped
- Tracks languages in a Set to detect duplicates

## Development Workflow

### 1. Create a New Plugin

```bash
# Create directory structure
mkdir -p FlowPluginsTs/CommunityFlowPlugins/<category>/<pluginName>/1.0.0
mkdir -p tests/FlowPlugins/CommunityFlowPlugins/<category>/<pluginName>/1.0.0

# Create plugin file
touch FlowPluginsTs/CommunityFlowPlugins/<category>/<pluginName>/1.0.0/index.ts

# Create test file
touch tests/FlowPlugins/CommunityFlowPlugins/<category>/<pluginName>/1.0.0/index.test.ts
```

### 2. Develop and Test

```bash
# Compile TypeScript
tsc

# Run linter with auto-fix
npm run lint:fix

# Run custom plugin checks
npm run checkPlugins

# Run tests
npm run test

# Or run specific plugin tests
npm run test -- <pluginName>
```

### 3. Commit Changes

```bash
git add .
git commit -m "feat: add new plugin"
git push origin <branch-name>
```

## Deploying Plugins to Tdarr

### Development Setup (Local Testing)

1. **Set Environment Variable**
   ```bash
   export pluginsDir=/Users/maximberezin/code/Tdarr_Plugins
   ```

   Or add to `~/.zshrc` for persistence:
   ```bash
   echo 'export pluginsDir=/Users/maximberezin/code/Tdarr_Plugins' >> ~/.zshrc
   source ~/.zshrc
   ```

2. **Start Tdarr Server and Node**
   - The `pluginsDir` must be set BEFORE starting Tdarr
   - Tdarr will skip auto-updates for directories containing `.git` (development mode)

3. **Restart and Refresh**
   - Restart Tdarr Server and Node after changing `pluginsDir`
   - Refresh the Tdarr UI in browser
   - Navigate to Flows tab
   - Create or edit a flow
   - Look for your plugin in the appropriate category

### Production Deployment

For production Tdarr instances:

1. **Docker Compose**
   ```yaml
   environment:
     - pluginsDir=/path/to/Tdarr_Plugins
   volumes:
     - /path/to/Tdarr_Plugins:/plugins
   ```

2. **Systemd Service**
   Add to service file:
   ```ini
   Environment="pluginsDir=/path/to/Tdarr_Plugins"
   ```

### Plugin Locations

- **Flow Plugins**: Auto-loaded from `FlowPlugins/` subdirectories
- **Classic Plugins**: Located in `Community/` directory
- **Local Plugins** (Classic): User-created plugins in `Tdarr/Plugins/Local/`

⚠️ **Important**: Do NOT copy Flow plugins to `Tdarr/Plugins/Local/` - they won't work there. Flow plugins must remain in the `FlowPlugins/` directory structure.

## FFmpeg Command Flow Pattern

Most FFmpeg-based plugins follow this pattern:

1. **Begin Command** (`ffmpegCommandStart`)
   - Initializes `ffmpegCommand` structure
   - Loads streams from input file
   - Sets up base command

2. **Modify Streams** (Various plugins)
   - Add, remove, or configure streams
   - Set encoding options
   - Manage stream mapping

3. **Execute** (`ffmpegCommandExecute`)
   - Builds final FFmpeg command
   - Executes command
   - Returns output file

### Stream Management

Streams have these important properties:
- `removed`: Boolean - whether to exclude from output
- `mapArgs`: Array - FFmpeg `-map` arguments (e.g., `['-map', '0:1']`)
- `inputArgs`: Array - Input-specific FFmpeg arguments
- `outputArgs`: Array - Output-specific FFmpeg arguments (e.g., `['-c:a:0', 'copy']`)
- `forceEncoding`: Boolean - force re-encoding even if codec matches

## Documentation References

### Official Documentation
- **Tdarr Docs**: https://docs.tdarr.io/
- **Plugin Basics**: https://docs.tdarr.io/docs/plugins/basics
- **Plugin Repository**: https://github.com/HaveAGitGat/Tdarr_Plugins
- **Main Tdarr App**: https://github.com/HaveAGitGat/Tdarr (symlinked at `./Tdarr/`)

### Community Resources
- **Reddit**: https://www.reddit.com/r/Tdarr/
- **Discord**: https://discord.gg/GF8X8cq

### Related Tools
- **FFmpeg Documentation**: https://ffmpeg.org/documentation.html
- **FFprobe**: https://ffmpeg.org/ffprobe.html
- **HandBrake**: https://handbrake.fr/docs/

## Testing

### Test Structure

Tests use Jest and follow this pattern:

```typescript
import { plugin } from '../../path/to/plugin/index';
import { IpluginInputArgs } from '../../path/to/interfaces';

describe('Plugin Name', () => {
  let baseArgs: IpluginInputArgs;

  beforeEach(() => {
    // Set up test args
    baseArgs = {
      inputs: { /* plugin inputs */ },
      variables: { /* ffmpegCommand, etc */ },
      inputFileObj: { /* file metadata */ },
      jobLog: jest.fn(),
      // ... other required properties
    };
  });

  it('should do something', async () => {
    const result = await plugin(baseArgs);
    expect(result.outputNumber).toBe(1);
    // ... assertions
  });
});
```

### Running Tests

```bash
# All tests
npm run test

# Flow plugin tests only
npm run test:flows

# Specific plugin
npm run test -- <pluginName>
```

## Common Issues and Solutions

### TypeScript Compilation Errors
- **Issue**: `Property 'require' does not exist on type 'Ideps'`
- **Solution**: Use `require('child_process')` directly, not `args.deps.require()`

### ESLint Errors
- **Issue**: Empty arrow functions
- **Solution**: Add `// eslint-disable-next-line @typescript-eslint/no-empty-function`

### Line Length
- **Issue**: Max line length 120 characters
- **Solution**: Break long lines, especially in tests

### SSH Authentication
- **Issue**: Wrong GitHub account used
- **Solution**: Use SSH config aliases (see SSH Setup section above)

### Plugin Not Appearing in Tdarr UI
- **Issue**: Plugin not visible after adding
- **Solution**:
  1. Verify `pluginsDir` environment variable is set
  2. Restart Tdarr Server and Node
  3. Refresh browser
  4. Check that plugin is in `FlowPlugins/` not `Tdarr/Plugins/Local/`

## File Structure Overview

```
Tdarr_Plugins/
├── .claude/
│   └── CLAUDE.md                    # This file
├── Community/                       # Classic plugins (JavaScript)
├── FlowPlugins/                     # Compiled Flow plugins (JavaScript)
│   └── CommunityFlowPlugins/
│       └── <category>/
│           └── <pluginName>/
│               └── 1.0.0/
│                   └── index.js     # Compiled plugin
├── FlowPluginsTs/                   # Source Flow plugins (TypeScript)
│   └── CommunityFlowPlugins/
│       └── <category>/
│           └── <pluginName>/
│               └── 1.0.0/
│                   └── index.ts     # Plugin source
├── FlowHelpers/                     # Helper functions and interfaces
├── tests/                           # Test files
│   ├── FlowPlugins/
│   │   └── CommunityFlowPlugins/
│   │       └── <category>/
│   │           └── <pluginName>/
│   │               └── 1.0.0/
│   │                   └── index.test.ts
│   └── sampleData/                  # Test fixtures
├── Tdarr/                           # Symlink to main Tdarr app
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
├── .eslintrc.js                     # ESLint configuration
└── README.md                        # Repository README
```

## Quick Reference Commands

```bash
# Development cycle
tsc                          # Compile TypeScript
npm run lint:fix             # Fix linting issues
npm run checkPlugins         # Validate plugins
npm run test                 # Run tests
git add .                    # Stage changes
git commit -m "message"      # Commit
git push origin branch       # Push to remote

# Deploy to Tdarr
export pluginsDir=$(pwd)     # Set plugin directory
# Restart Tdarr Server and Node
# Refresh Tdarr UI

# Check versions
node --version               # Node.js version
npm --version                # npm version
tsc --version                # TypeScript version
```
