
import { SpawnOptions } from 'child_process';
import { Subprocess } from './Subprocess'
import { SubprocessResult } from './SubprocessResult';

export interface StartShellCommandOptions {
    spawnOptions?: SpawnOptions
    enableOutputBuffering?: boolean
    onStdout?: (line: string) => void;
    onStderr?: (line: string) => void;
    pipePrefix?: string | boolean;
}

export function startShellCommand(command: string | string[], options: StartShellCommandOptions = {}): Subprocess {
    const subprocess = new Subprocess({
        enableOutputBuffering: options.enableOutputBuffering
    });

    if (options.pipePrefix) {
        let prefix = `[${options.pipePrefix}]`;

        if (options.pipePrefix === true) {
            prefix = `[${command}]`;
        }

        subprocess.onStdout(line => {
            console.log(`${prefix} ${line}`);
        });
        subprocess.onStderr(line => {
            console.error(`${prefix} [stderr] ${line}`);
        });
    }
    
    if (options.onStdout) {
        subprocess.onStdout(options.onStdout);
    }

    if (options.onStderr) {
        subprocess.onStderr(options.onStderr);
    }

    subprocess.start(command, options.spawnOptions);

    return subprocess;
}

/*
 runShellCommand

    Runs a shell command in a subprocess, with lots of convenience options.
*/
export async function runShellCommand(command: string | string[], options: StartShellCommandOptions = {}) {

    const subprocess = startShellCommand(command, options);

    await subprocess.waitForExit();

    const result = new SubprocessResult();
    result.exitCode = subprocess.proc.exitCode; // This can be null if process was killed or didn't exit normally
    result.stdout = subprocess.getStdout();
    result.stderr = subprocess.getStderr();
    result.subprocess = subprocess;

    return result;
}
