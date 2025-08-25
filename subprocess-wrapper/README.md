
# subprocess-wrapper

A helpful wrapper around Node.js child processes with line-based parsing, event listeners, and promise support.

## Features

- Parses stdout and stderr as lines
- Event listeners for stdout/stderr output
- Output buffering with getters
- Promise-based process completion
- Error handling and process management
- Shell command convenience functions

## Installation

```bash
npm install @andyfischer/subprocess-wrapper
```

## Quick Start

```typescript
import { runShellCommand, startShellCommand, Subprocess } from '@andyfischer/subprocess-wrapper';

// Run a command and wait for completion
const result = await runShellCommand('ls -la');
console.log(result.stdout);

// Start a command with real-time output
const subprocess = startShellCommand('ping google.com', {
  spawnOptions: {
      ...
  },
  onStdout: (line) => console.log('OUT:', line),
  onStderr: (line) => console.log('ERR:', line)
});
```

## API Reference

### High-Level Functions

#### `runShellCommand(command, options?)`

Runs a shell command and returns a promise that resolves with the complete result.

**Parameters:**
- `command: string | string[]` - Command to run (string will be split on spaces)
- `options?: ShellCommandOptions` - Configuration options

**Returns:** `Promise<SubprocessResult>`

**Example:**
```typescript
const result = await runShellCommand('echo "Hello World"');
console.log(result.stdout); // ['Hello World']
console.log(result.exitCode); // 0
console.log(result.failed()); // false
```

#### `startShellCommand(command, options?)`

Starts a shell command and returns a Subprocess instance for real-time interaction.

**Parameters:**
- `command: string | string[]` - Command to run
- `options?: ShellCommandOptions` - Configuration options

**Returns:** `Subprocess`

**Example:**
```typescript
const subprocess = startShellCommand('tail -f /var/log/system.log', {
  onStdout: (line) => console.log('LOG:', line),
  enableOutputBuffering: false
});

// Stop the process after 10 seconds
setTimeout(() => subprocess.kill(), 10000);
```

### Classes

#### `Subprocess`

Main class for managing a subprocess with event-driven output handling.

**Constructor:**
```typescript
new Subprocess(options?: { enableOutputBuffering?: boolean })
```

**Fields:**

##### `.proc`
- The underlying ChildProcess object.

**Methods:**

##### `start(command, options?)`
Starts the subprocess.
- `command: string | string[]` - Command to execute
- `options?: SubprocessOptions` - Node.js spawn options

**Example:**
```typescript
const subprocess = new Subprocess();
subprocess.onStdout(line => console.log('Output:', line));
subprocess.start(['ls', '-la'], { cwd: '/tmp' });
await subprocess.waitForExit();
```

##### `onStdout(listener)`
Adds a listener for stdout lines.
- `listener: (line: string) => void` - Callback for each stdout line

**Example:**
```typescript
subprocess.onStdout((line) => {
  console.log('Received:', line);
});
```

##### `onStderr(listener)`
Adds a listener for stderr lines.
- `listener: (line: string) => void` - Callback for each stderr line

**Example:**
```typescript
subprocess.onStderr((line) => {
  console.error('Error output:', line);
});
```

##### `getStdout()`
Returns all stdout lines as an array (requires `enableOutputBuffering: true`).

**Returns:** `string[]`

**Example:**
```typescript
const subprocess = new Subprocess({ enableOutputBuffering: true });
subprocess.start('ls -la');
await subprocess.waitForExit();
const lines = subprocess.getStdout();
console.log('All output lines:', lines);
```

##### `getStderr()`
Returns all stderr lines as an array (requires `enableOutputBuffering: true`).

**Returns:** `string[]`

##### `waitForExit()`
Returns a promise that resolves when the process exits.

**Returns:** `Promise<void>`

**Example:**
```typescript
const subprocess = startShellCommand('sleep 5');
console.log('Process started...');
await subprocess.waitForExit();
console.log('Process completed!');
```

##### `kill()`
Terminates the running process.

**Example:**
```typescript
const subprocess = startShellCommand('ping google.com');

// Kill after 5 seconds
setTimeout(() => {
  subprocess.kill();
  console.log('Process terminated');
}, 5000);
```

#### `SubprocessResult`

Result object returned by `runShellCommand()`.

**Properties:**
- `exitCode: number` - Process exit code
- `stdout: string[]` - Array of stdout lines
- `stderr: string[]` - Array of stderr lines
- `subprocess: Subprocess` - Reference to the subprocess instance

**Methods:**

##### `failed()`
Returns true if the process failed (non-zero exit code).

**Returns:** `boolean`

##### `asError()`
Converts the result to an Error object (only if failed).

**Returns:** `Error`

**Example:**
```typescript
const result = await runShellCommand('cat nonexistent-file');
if (result.failed()) {
  throw result.asError(); // Throws error with stderr message
}
```

##### `stdoutAsString()`
Returns stdout as a single string with newlines.

**Returns:** `string`

##### `stderrAsString()`
Returns stderr as a single string with newlines.

**Returns:** `string`

**Example:**
```typescript
const result = await runShellCommand('ls -la');
console.log(result.stdoutAsString()); // Multi-line string output
```

### Options

#### `ShellCommandOptions`

Configuration options for shell commands.

```typescript
interface ShellCommandOptions {
  spawnOptions: SpawnOptions              // Options sent to `spawn` in `child_process`
  enableOutputBuffering?: boolean;        // Buffer output for getStdout/getStderr
  onStdout?: (line: string) => void;      // Stdout line callback
  onStderr?: (line: string) => void;      // Stderr line callback
  pipePrefix?: string | boolean;          // Prefix for piped output to console
}
```

## Usage Examples

### Basic Command Execution

```typescript
import { runShellCommand } from '@andyfischer/subprocess-wrapper';

// Simple command
const result = await runShellCommand('echo "Hello"');
console.log(result.stdout[0]); // "Hello"

// Command with arguments
const result2 = await runShellCommand(['ls', '-la', '/tmp']);
console.log(result2.stdout);
```

### Real-time Output Processing

```typescript
import { startShellCommand } from '@andyfischer/subprocess-wrapper';

const subprocess = startShellCommand('npm install', {
  spawnOptions: {
    cwd: '/path/to/project',
  },
  onStdout: (line) => console.log('📦', line),
  onStderr: (line) => console.error('❌', line)
});

await subprocess.waitForExit();
console.log('Installation complete!');
```

### Long-running Process Management

```typescript
const logWatcher = startShellCommand('tail -f /var/log/app.log', {
  enableOutputBuffering: false,
  onStdout: (line) => {
    if (line.includes('ERROR')) {
      console.error('🚨 Error detected:', line);
    }
  }
});

// Stop watching after 1 minute
setTimeout(() => logWatcher.kill(), 60000);
```

### Error Handling

```typescript
try {
  const result = await runShellCommand('invalid-command');
  if (result.failed()) {
    console.error('Command failed:', result.asError().message);
    console.error('Stderr:', result.stderrAsString());
  }
} catch (error) {
  console.error('Execution error:', error.message);
}
```

### Custom Environment and Working Directory

```typescript
const result = await runShellCommand('node build.js', {
  spawnOptions: {
    cwd: '/path/to/project',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BUILD_TARGET: 'web'
    }
  }
});
```

### Collecting Output Arrays

```typescript
const subprocess = new Subprocess({ enableOutputBuffering: true });
subprocess.start('find . -name "*.js"');
await subprocess.waitForExit();

const jsFiles = subprocess.getStdout();
console.log(`Found ${jsFiles.length} JavaScript files:`);
jsFiles.forEach(file => console.log(file));
```

## Advanced Usage

### Multiple Listeners

```typescript
const subprocess = startShellCommand('build-script.sh');

// Add multiple stdout listeners
subprocess.onStdout((line) => logToFile(line));
subprocess.onStdout((line) => updateProgressBar(line));
subprocess.onStdout((line) => checkForWarnings(line));
```

### Process Monitoring

```typescript
const subprocess = startShellCommand('long-running-process');

subprocess.onStdout((line) => console.log('OUT:', line));
subprocess.onStderr((line) => console.log('ERR:', line));

const timeout = setTimeout(() => {
  console.log('Process taking too long, killing...');
  subprocess.kill();
}, 30000);

await subprocess.waitForExit();
clearTimeout(timeout);
console.log('Process completed with code:', subprocess.exitCode);
```
