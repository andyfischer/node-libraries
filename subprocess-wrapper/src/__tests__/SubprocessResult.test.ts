import { describe, it, expect, beforeEach } from 'vitest';
import { SubprocessResult } from '../SubprocessResult';
import { Subprocess } from '../Subprocess';

describe('SubprocessResult', () => {
    let result: SubprocessResult;
    let mockSubprocess: Subprocess;

    beforeEach(() => {
        result = new SubprocessResult();
        mockSubprocess = new Subprocess();
        mockSubprocess.command = ['node', 'test-script.js'];
    });

    describe('failed() method', () => {
        it('should return false for exit code 0', () => {
            result.exitCode = 0;
            expect(result.failed()).toBe(false);
        });

        it('should return true for non-zero exit codes', () => {
            result.exitCode = 1;
            expect(result.failed()).toBe(true);

            result.exitCode = 42;
            expect(result.failed()).toBe(true);

            result.exitCode = -1;
            expect(result.failed()).toBe(true);
        });

        it('should return true for null exit code (process killed/abnormal termination)', () => {
            result.exitCode = null;
            expect(result.failed()).toBe(true);
        });
    });

    describe('asError() method', () => {
        it('should throw error when called on successful result', () => {
            result.exitCode = 0;
            result.subprocess = mockSubprocess;
            
            expect(() => result.asError()).toThrow(
                'SubprocessResult usage error: asError called but failed() = false'
            );
        });

        it('should return error with stderr message when stderr exists', () => {
            result.exitCode = 1;
            result.stderr = ['Error: Something went wrong', 'Additional error info'];
            result.subprocess = mockSubprocess;
            
            const error = result.asError();
            
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toContain('Subprocess "node test-script.js" failed with stderr:');
            expect(error.message).toContain('Error: Something went wrong Additional error info');
        });

        it('should return error with exit code when no stderr', () => {
            result.exitCode = 42;
            result.stderr = [];
            result.subprocess = mockSubprocess;
            
            const error = result.asError();
            
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toContain('Subprocess "node test-script.js" failed with exit code: 42');
        });

        it('should handle null exit code in error message', () => {
            result.exitCode = null;
            result.stderr = [];
            result.subprocess = mockSubprocess;
            
            const error = result.asError();
            
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toContain('failed with exit code: unknown');
        });

        it('should handle missing subprocess gracefully', () => {
            result.exitCode = 1;
            result.stderr = ['Some error'];
            // result.subprocess is undefined
            
            const error = result.asError();
            
            expect(error.message).toContain('Subprocess failed with stderr:');
            expect(error.message).not.toContain('undefined');
        });

        it('should handle missing command in subprocess', () => {
            result.exitCode = 1;
            result.stderr = ['Some error'];
            result.subprocess = new Subprocess(); // No command set
            
            const error = result.asError();
            
            expect(error.message).toContain('Subprocess failed with stderr:');
        });
    });

    describe('stdoutAsString() method', () => {
        it('should join stdout lines with newlines', () => {
            result.stdout = ['Line 1', 'Line 2', 'Line 3'];
            
            const output = result.stdoutAsString();
            
            expect(output).toBe('Line 1\nLine 2\nLine 3');
        });

        it('should return empty string for empty stdout', () => {
            result.stdout = [];
            
            const output = result.stdoutAsString();
            
            expect(output).toBe('');
        });

        it('should handle stdout with empty lines', () => {
            result.stdout = ['Line 1', '', 'Line 3'];
            
            const output = result.stdoutAsString();
            
            expect(output).toBe('Line 1\n\nLine 3');
        });

        it('should handle single line stdout', () => {
            result.stdout = ['Single line'];
            
            const output = result.stdoutAsString();
            
            expect(output).toBe('Single line');
        });
    });

    describe('stderrAsString() method', () => {
        it('should join stderr lines with newlines', () => {
            result.stderr = ['Error 1', 'Error 2', 'Error 3'];
            
            const output = result.stderrAsString();
            
            expect(output).toBe('Error 1\nError 2\nError 3');
        });

        it('should return empty string for empty stderr', () => {
            result.stderr = [];
            
            const output = result.stderrAsString();
            
            expect(output).toBe('');
        });

        it('should handle stderr with empty lines', () => {
            result.stderr = ['Error 1', '', 'Error 3'];
            
            const output = result.stderrAsString();
            
            expect(output).toBe('Error 1\n\nError 3');
        });
    });

    describe('integration with real data', () => {
        it('should work with realistic subprocess result data', () => {
            result.exitCode = 1;
            result.stdout = [
                'Processing started...',
                'Found 5 items',
                'Processing complete'
            ];
            result.stderr = [
                'Warning: deprecated API used',
                'Error: failed to process item 3'
            ];
            result.subprocess = mockSubprocess;
            
            expect(result.failed()).toBe(true);
            expect(result.stdoutAsString()).toBe('Processing started...\nFound 5 items\nProcessing complete');
            expect(result.stderrAsString()).toBe('Warning: deprecated API used\nError: failed to process item 3');
            
            const error = result.asError();
            expect(error.message).toContain('failed with stderr');
            expect(error.message).toContain('Warning: deprecated API used Error: failed to process item 3');
        });

        it('should handle successful result with output', () => {
            result.exitCode = 0;
            result.stdout = ['Success: All items processed'];
            result.stderr = [];
            result.subprocess = mockSubprocess;
            
            expect(result.failed()).toBe(false);
            expect(result.stdoutAsString()).toBe('Success: All items processed');
            expect(result.stderrAsString()).toBe('');
            expect(() => result.asError()).toThrow();
        });

        it('should handle process that was killed (null exit code)', () => {
            result.exitCode = null;
            result.stdout = ['Partial output'];
            result.stderr = [];
            result.subprocess = mockSubprocess;
            
            expect(result.failed()).toBe(true);
            expect(result.stdoutAsString()).toBe('Partial output');
            
            const error = result.asError();
            expect(error.message).toContain('exit code: unknown');
        });
    });

    describe('edge cases', () => {
        it('should handle undefined stdout/stderr arrays', () => {
            // @ts-ignore - testing edge case
            result.stdout = undefined;
            // @ts-ignore - testing edge case  
            result.stderr = undefined;
            
            expect(() => result.stdoutAsString()).toThrow();
            expect(() => result.stderrAsString()).toThrow();
        });

        it('should handle very long command arrays in error messages', () => {
            result.exitCode = 1;
            result.stderr = ['Error occurred'];
            
            const longCommand = new Subprocess();
            longCommand.command = ['node', 'script.js', 'arg1', 'arg2', 'arg3', 'arg4', 'arg5'];
            result.subprocess = longCommand;
            
            const error = result.asError();
            expect(error.message).toContain('node script.js arg1 arg2 arg3 arg4 arg5');
        });
    });
});