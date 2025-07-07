import { Stream, captureError } from "@andyfischer/streams";
import { spawn as nodeSpawn } from 'child_process';
import { unixPipeToLines } from "@andyfischer/parse-stdout-lines";
import { existsSync } from 'fs';
type SpawnOptions = Parameters<typeof nodeSpawn>[2];
export type ProcessEvent = StdoutEvent | StdoutClosedEvent | StderrEvent | SpawnEvent | SpawnErrorEvent | ExitEvent;
export enum ProcessEventType {
    stdout = 1,
    stderr,
    spawn,
    spawn_error,
    stdout_closed,
    exit
}
export interface StdoutEvent {
    type: ProcessEventType.stdout;
    line: string;
}
export interface StdoutClosedEvent {
    type: ProcessEventType.stdout_closed;
}
export interface StderrEvent {
    type: ProcessEventType.stderr;
    line: string;
}
export interface SpawnEvent {
    type: ProcessEventType.spawn;
}
export interface SpawnErrorEvent {
    type: ProcessEventType.spawn_error;
}
export interface ExitEvent {
    type: ProcessEventType.exit;
    code: number;
}
export interface SpawnOutput {
    output: Stream<ProcessEvent>;
    proc: any;
}
const VerboseLog = false;
function verboseLog(...args: any[]) {
    if (VerboseLog) {
        console.log('[spawnProcess]', ...args);
    }
}
export function spawnProcess(command: string | string[], options: SpawnOptions = {}): SpawnOutput {
    verboseLog(`spawning: ${command}`);
    if (typeof command === 'string') {
        command = command.split(' ');
    }
    const output = new Stream<ProcessEvent>();
    const binFilename = command[0];
    // Error immediately if the bin filename is not found
    /* todo - we can't always do this check, revisit later? */
    if (!existsSync(binFilename) && !options.shell) {
        // throw new Error(`Binary file not found: ${binFilename}`);
    }
    const proc = nodeSpawn(binFilename, command.slice(1), options);
    unixPipeToLines(proc.stdout, line => {
        verboseLog(`got stdout data: ${line}`);
        if (output.isClosed())
            return;
        if (line === null) {
            output.item({
                type: ProcessEventType.stdout_closed
            });
            return;
        }
        output.item({
            type: ProcessEventType.stdout,
            line
        });
    });
    unixPipeToLines(proc.stderr, line => {
        verboseLog(`got stderr data: ${line}`);
        if (output.isClosed())
            return;
        if (line === null) {
            return;
        }
        output.item({
            type: ProcessEventType.stderr,
            line
        });
    });
    proc.on('spawn', () => {
        verboseLog(`on spawn`);
        if (output.isClosed())
            return;
        output.item({
            type: ProcessEventType.spawn
        });
    });
    proc.on('error', err => {
        verboseLog(`on error`, err.message);
        if (output.isClosed())
            return;
        output.logError({ errorMessage: err.message, errorType: 'child_process_error', cause: captureError(err) });
        output.item({
            type: ProcessEventType.spawn_error
        });
    });
    proc.on('close', code => {
        verboseLog(`on close`, code);
        if (output.isClosed())
            return;
        output.item({
            type: ProcessEventType.exit,
            code
        });
        output.done();
    });
    return { output, proc };
}
