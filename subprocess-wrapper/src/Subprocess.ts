import { SpawnOptions as SubprocessOptions } from "child_process";
import { ProcessEvent, ProcessEventType, spawnProcess } from "./spawnProcess";
import { c_item, StreamEvent, StreamDispatcher } from "@andyfischer/streams";
export type { SpawnOptions as SubprocessOptions } from "child_process";
interface SetupOptions {
    enableOutputBuffering?: boolean;
}
/*
 Subprocess

 Object that wraps around a single call to spawnProcess.

 Adds event listeners on the ProcessEvent stream.
*/
export class Subprocess {
    proc: any;
    command: string[];
    setupOptions: SetupOptions;
    options: SubprocessOptions;
    stdoutListeners?: StreamDispatcher<string>;
    stderrListeners?: StreamDispatcher<string>;
    private stdout: string[] = [];
    private stderr: string[] = [];
    exitPromise?: Promise<void>;
    exitPromiseResolve?: () => void;
    hasExited: boolean = false;
    exitCode: number | null = null;
    constructor(setupOptions: SetupOptions = {}) {
        this.setupOptions = setupOptions;
        if (this.setupOptions.enableOutputBuffering === undefined) {
            this.setupOptions.enableOutputBuffering = true;
        }
    }
    start(command: string | string[], options: SubprocessOptions = {}) {
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
    waitForExit(): Promise<void> {
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
