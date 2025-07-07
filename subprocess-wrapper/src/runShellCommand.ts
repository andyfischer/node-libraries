import { Subprocess, SubprocessOptions } from './Subprocess';
import { SubprocessResult } from './SubprocessResult';
export interface ShellCommandOptions {
    cwd?: string;
    stdio?: SubprocessOptions['stdio'];
    env?: SubprocessOptions['env'];
    shell?: SubprocessOptions['shell'];
    enableOutputBuffering?: boolean;
    onStdout?: (line: string) => void;
    onStderr?: (line: string) => void;
    pipePrefix?: string | boolean;
}
function convertRunOptionsToSubprocessOptions(options: ShellCommandOptions): SubprocessOptions {
    const subprocessOptions: SubprocessOptions = {
        cwd: options.cwd,
        env: options.env,
        stdio: options.stdio,
        shell: options.shell,
    };
    return subprocessOptions;
}
export function startShellCommand(command: string | string[], options: ShellCommandOptions = {}): Subprocess {
    const subprocess = new Subprocess({
        enableOutputBuffering: options.enableOutputBuffering
    });
    const subprocessOptions = convertRunOptionsToSubprocessOptions(options);
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
    subprocess.start(command, subprocessOptions);
    return subprocess;
}
/*
 runShellCommand

    Runs a shell command in a subprocess, with lots of convenience options.
*/
export async function runShellCommand(command: string | string[], options: ShellCommandOptions = {}) {
    const subprocess = startShellCommand(command, options);
    await subprocess.waitForExit();
    const result = new SubprocessResult();
    result.exitCode = subprocess.proc.exitCode;
    result.stdout = subprocess.getStdout();
    result.stderr = subprocess.getStderr();
    result.subprocess = subprocess;
    return result;
}
