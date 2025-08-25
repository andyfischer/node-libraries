import { ChildProcess, SpawnOptions } from "child_process";
import { ProcessEvent, ProcessEventType, spawnProcess } from "./spawnProcess";
import { c_item, StreamEvent, StreamDispatcher } from "@andyfischer/streams";

export type { SpawnOptions as SubprocessOptions } from "child_process";

interface SetupOptions {
    enableOutputBuffering?: boolean;
}

/*
 Subprocess

 Helper object that wraps around a single call to spawnProcess.

 This adds event listeners on the ProcessEvent stream, including:
  - Promise based listener for 'started' and 'exited' events.
  - Callbacks to get stdout and stderr lines when they happen.
  - Buffering of stdout and stderr lines if enabled.
*/
export class Subprocess {
    proc: ChildProcess
    command: string[]
    setupOptions: SetupOptions
    options: SpawnOptions

    stdoutListeners?: StreamDispatcher<string>
    stderrListeners?: StreamDispatcher<string>

    private stdout: string[] = []
    private stderr: string[] = []

    startedPromise?: Promise<void>
    startedPromiseResolve?: () => void
    startedPromiseReject?: (error: Error) => void

    exitPromise?: Promise<void>
    exitPromiseResolve?: () => void

    hasStarted: boolean = false
    hasFailed: Error | null = null
    hasExited: boolean = false
    exitCode: number | null = null;
    
    constructor(setupOptions: SetupOptions = {}) {
        this.setupOptions = setupOptions;
        
        if (this.setupOptions.enableOutputBuffering === undefined) {
            this.setupOptions.enableOutputBuffering = true;
        }
    }

    start(
        command: string | string[], options: SpawnOptions = {}
    ) {
        if (this.proc) {
            throw new Error("usage error: process already started");
        }

        const { output, proc } = spawnProcess(command, options);

        this.proc = proc;

        output.pipe((event: StreamEvent<ProcessEvent>) => {
            switch (event.t) {

            case c_item:
                const processEvent = event.item;

                switch (processEvent.type) {

                case ProcessEventType.stdout:

                    if (this.setupOptions.enableOutputBuffering) { 
                        this.stdout.push(processEvent.line);
                    }

                    if (this.stdoutListeners) {
                        this.stdoutListeners.item(processEvent.line);
                    }
                    break;

                case ProcessEventType.stderr:
                    if (this.setupOptions.enableOutputBuffering) {
                        this.stderr.push(processEvent.line);
                    }
                    if (this.stderrListeners) {
                        this.stderrListeners.item(processEvent.line);
                    }
                    break;

                case ProcessEventType.stdout_closed:
                    if (this.stdoutListeners) {
                        this.stdoutListeners.close();
                    }
                    break;

                case ProcessEventType.spawn:
                    this.hasStarted = true;
                    if (this.startedPromiseResolve) {
                        this.startedPromiseResolve();
                    }
                    break;

                case ProcessEventType.spawn_error:
                    this.hasFailed = processEvent.error;
                    if (this.startedPromiseReject) {
                        this.startedPromiseReject(processEvent.error);
                    }
                    break;

                case ProcessEventType.exit:
                    this.hasExited = true;
                    this.exitCode = processEvent.code;
                    if (this.exitPromiseResolve) {
                        this.exitPromiseResolve();
                    }
                    break;
                }
            }
        });
    }

    onStdout(listener: (line: string) => void) {
        if (!this.stdoutListeners) {
            this.stdoutListeners = new StreamDispatcher();
        }
        this.stdoutListeners.newListener().pipe(event => {
            if (event.t === c_item) {
                listener(event.item);
            }
        });
    }

    onStderr(listener: (line: string) => void) {
        if (!this.stderrListeners) {
            this.stderrListeners = new StreamDispatcher();
        }
        this.stderrListeners.newListener().pipe(event => {
            if (event.t === c_item) {
                listener(event.item);
            }
        });
    }

    kill() {
        if (this.proc) {
            this.proc.kill();
        }
    }

    waitForStart(): Promise<void> {
        if (this.hasStarted) {
            return Promise.resolve();
        }

        if (this.hasFailed) {
            return Promise.reject(this.hasFailed);
        }

        if (!this.startedPromise) {
            this.startedPromise = new Promise<void>((resolve, reject) => {
                this.startedPromiseResolve = resolve;
                this.startedPromiseReject = reject;
            });
        }

        return this.startedPromise;
    }

    waitForExit(): Promise<void> {
        if (this.hasExited) {
            return Promise.resolve();
        }

        if (!this.exitPromise) {
            this.exitPromise = new Promise<void>((resolve) => {
                this.exitPromiseResolve = resolve;
            });
        }

        return this.exitPromise;
    }
    
    getStdout(): string[] {
        if (this.setupOptions.enableOutputBuffering) {
            return this.stdout;
        }
        throw new Error("getStdout usage error - Output buffering is not enabled");
    }
    
    getStderr(): string[] {
        if (this.setupOptions.enableOutputBuffering) {
            return this.stderr;
        }
        throw new Error("getStderr usage error - Output buffering is not enabled");
    }
}