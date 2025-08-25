import { describe, it, expect, beforeEach } from 'vitest';
import { Subprocess } from '../Subprocess';
import path from 'path';

const fixturesDir = path.join(__dirname, 'fixtures');

describe('Subprocess', () => {
    let subprocess: Subprocess;

    beforeEach(() => {
        subprocess = new Subprocess();
    });

    describe('basic functionality', () => {
        it('should execute a simple script and capture output', async () => {
            const helloScript = path.join(fixturesDir, 'hello.js');
            
            subprocess.start(['node', helloScript]);
            
            await subprocess.waitForStart();
            expect(subprocess.hasStarted).toBe(true);
            
            await subprocess.waitForExit();
            expect(subprocess.hasExited).toBe(true);
            expect(subprocess.exitCode).toBe(0);
            
            const stdout = subprocess.getStdout();
            expect(stdout).toContain('Hello, World!');
        });

        it('should handle command arguments', async () => {
            const argsScript = path.join(fixturesDir, 'echo-args.js');
            
            subprocess.start(['node', argsScript, 'arg1', 'arg2', 'arg3']);
            
            await subprocess.waitForExit();
            
            const stdout = subprocess.getStdout();
            expect(stdout.join('\n')).toContain('Args received: arg1 arg2 arg3');
        });

        it('should capture stderr output separately', async () => {
            const stderrScript = path.join(fixturesDir, 'stderr-test.js');
            
            subprocess.start(['node', stderrScript]);
            
            await subprocess.waitForExit();
            
            const stdout = subprocess.getStdout();
            const stderr = subprocess.getStderr();
            
            expect(stdout.join('\n')).toContain('This is stdout');
            expect(stderr.join('\n')).toContain('This is stderr');
        });

        it('should handle non-zero exit codes', async () => {
            const exitCodeScript = path.join(fixturesDir, 'exit-code.js');
            
            subprocess.start(['node', exitCodeScript, '42']);
            
            await subprocess.waitForExit();
            
            expect(subprocess.exitCode).toBe(42);
            expect(subprocess.hasExited).toBe(true);
        });
    });

    describe('output buffering', () => {
        it('should enable output buffering by default', () => {
            const subprocess = new Subprocess();
            expect(subprocess.setupOptions.enableOutputBuffering).toBe(true);
        });

        it('should allow disabling output buffering', () => {
            const subprocess = new Subprocess({ enableOutputBuffering: false });
            expect(subprocess.setupOptions.enableOutputBuffering).toBe(false);
        });

        it('should throw error when getting output with buffering disabled', async () => {
            const subprocess = new Subprocess({ enableOutputBuffering: false });
            const helloScript = path.join(fixturesDir, 'hello.js');
            
            subprocess.start(['node', helloScript]);
            await subprocess.waitForExit();
            
            expect(() => subprocess.getStdout()).toThrow('Output buffering is not enabled');
            expect(() => subprocess.getStderr()).toThrow('Output buffering is not enabled');
        });
    });

    describe('event listeners', () => {
        it('should receive stdout events via onStdout', async () => {
            const multilineScript = path.join(fixturesDir, 'multiline-output.js');
            const receivedLines: string[] = [];
            
            subprocess.onStdout(line => {
                receivedLines.push(line);
            });
            
            subprocess.start(['node', multilineScript]);
            await subprocess.waitForExit();
            
            expect(receivedLines).toContain('First line');
            expect(receivedLines).toContain('Second line');
            expect(receivedLines).toContain('Third line with spaces');
        });

        it('should receive stderr events via onStderr', async () => {
            const multilineScript = path.join(fixturesDir, 'multiline-output.js');
            const receivedErrorLines: string[] = [];
            
            subprocess.onStderr(line => {
                receivedErrorLines.push(line);
            });
            
            subprocess.start(['node', multilineScript]);
            await subprocess.waitForExit();
            
            expect(receivedErrorLines).toContain('Error line 1');
            expect(receivedErrorLines).toContain('Error line 2');
        });

        it('should support multiple stdout listeners', async () => {
            const helloScript = path.join(fixturesDir, 'hello.js');
            const lines1: string[] = [];
            const lines2: string[] = [];
            
            subprocess.onStdout(line => lines1.push(line));
            subprocess.onStdout(line => lines2.push(line));
            
            subprocess.start(['node', helloScript]);
            await subprocess.waitForExit();
            
            expect(lines1).toContain('Hello, World!');
            expect(lines2).toContain('Hello, World!');
            expect(lines1).toEqual(lines2);
        });
    });

    describe('process lifecycle', () => {
        it('should properly track start state', async () => {
            const helloScript = path.join(fixturesDir, 'hello.js');
            
            expect(subprocess.hasStarted).toBe(false);
            
            subprocess.start(['node', helloScript]);
            
            await subprocess.waitForStart();
            expect(subprocess.hasStarted).toBe(true);
        });

        it('should handle slow processes', async () => {
            const slowScript = path.join(fixturesDir, 'slow-output.js');
            
            subprocess.start(['node', slowScript, '50']);
            
            await subprocess.waitForStart();
            expect(subprocess.hasStarted).toBe(true);
            expect(subprocess.hasExited).toBe(false);
            
            await subprocess.waitForExit();
            expect(subprocess.hasExited).toBe(true);
            
            const stdout = subprocess.getStdout();
            expect(stdout).toContain('Line 1');
            expect(stdout).toContain('Line 2');
            expect(stdout).toContain('Line 3');
        });

        it('should throw error when starting already started process', () => {
            const helloScript = path.join(fixturesDir, 'hello.js');
            
            subprocess.start(['node', helloScript]);
            
            expect(() => {
                subprocess.start(['node', helloScript]);
            }).toThrow('usage error: process already started');
        });
    });

    describe('process control', () => {
        it('should be able to kill a running process', async () => {
            const slowScript = path.join(fixturesDir, 'slow-output.js');
            
            subprocess.start(['node', slowScript, '1000']);
            await subprocess.waitForStart();
            
            subprocess.kill();
            await subprocess.waitForExit();
            
            expect(subprocess.hasExited).toBe(true);
        });
    });

    describe('command formats', () => {
        it('should handle string commands', async () => {
            const helloScript = path.join(fixturesDir, 'hello.js');
            
            subprocess.start('echo Hello from string command');
            
            await subprocess.waitForExit();
            
            const stdout = subprocess.getStdout();
            expect(stdout).toContain('Hello from string command');
        });

        it('should handle array commands', async () => {
            const helloScript = path.join(fixturesDir, 'hello.js');
            
            subprocess.start(['node', helloScript]);
            
            await subprocess.waitForExit();
            
            const stdout = subprocess.getStdout();
            expect(stdout).toContain('Hello, World!');
        });

        it('should handle quoted arguments in string commands', async () => {
            subprocess.start('echo "hello world with spaces"');
            
            await subprocess.waitForExit();
            
            const stdout = subprocess.getStdout();
            expect(stdout).toContain('hello world with spaces');
        });

        it('should handle mixed quoted arguments', async () => {
            subprocess.start('echo "first arg" \'second arg\' third');
            
            await subprocess.waitForExit();
            
            const stdout = subprocess.getStdout();
            const output = stdout.join(' ');
            expect(output).toContain('first arg');
            expect(output).toContain('second arg');
            expect(output).toContain('third');
        });
    });

    describe('promise behavior', () => {
        it('should resolve waitForStart immediately if already started', async () => {
            const helloScript = path.join(fixturesDir, 'hello.js');
            
            subprocess.start(['node', helloScript]);
            await subprocess.waitForStart();
            
            // Should resolve immediately
            const startTime = Date.now();
            await subprocess.waitForStart();
            const duration = Date.now() - startTime;
            
            expect(duration).toBeLessThan(10);
        });

        it('should resolve waitForExit immediately if already exited', async () => {
            const helloScript = path.join(fixturesDir, 'hello.js');
            
            subprocess.start(['node', helloScript]);
            await subprocess.waitForExit();
            
            // Should resolve immediately
            const startTime = Date.now();
            await subprocess.waitForExit();
            const duration = Date.now() - startTime;
            
            expect(duration).toBeLessThan(10);
        });
    });
});