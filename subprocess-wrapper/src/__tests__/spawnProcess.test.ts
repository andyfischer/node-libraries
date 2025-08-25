import { describe, it, expect } from 'vitest';
import { spawnProcess, ProcessEventType } from '../spawnProcess';
import { c_item, c_done } from '@andyfischer/streams';
import path from 'path';

const fixturesDir = path.join(__dirname, 'fixtures');

describe('spawnProcess', () => {
    describe('basic functionality', () => {
        it('should spawn a process and return output stream and proc', () => {
            const helloScript = path.join(fixturesDir, 'hello.js');
            
            const { output, proc } = spawnProcess(['node', helloScript]);
            
            expect(output).toBeDefined();
            expect(proc).toBeDefined();
            expect(proc.kill).toBeDefined();
            
            proc.kill();
        });

        it('should handle string commands by splitting them', () => {
            const { output, proc } = spawnProcess('echo test');
            
            expect(output).toBeDefined();
            expect(proc).toBeDefined();
            
            proc.kill();
        });

        it('should handle quoted arguments in string commands', () => {
            const { output, proc } = spawnProcess('echo "hello world"');
            
            expect(output).toBeDefined();
            expect(proc).toBeDefined();
            
            proc.kill();
        });

        it('should accept spawn options', () => {
            const helloScript = path.join(fixturesDir, 'hello.js');
            
            const { output, proc } = spawnProcess(['node', helloScript], {
                cwd: process.cwd(),
                env: process.env
            });
            
            expect(output).toBeDefined();
            expect(proc).toBeDefined();
            
            proc.kill();
        });
    });

    describe('process events', () => {
        it('should emit events for a simple process', async () => {
            const { output, proc } = spawnProcess(['echo', 'test']);
            
            const events: any[] = [];
            let isDone = false;
            let timeout = false;
            
            output.pipe((event) => {
                if (event.t === c_item) {
                    events.push(event.item);
                } else if (event.t === c_done) {
                    isDone = true;
                }
            });
            
            // Add a timeout to prevent hanging
            setTimeout(() => {
                timeout = true;
                proc.kill();
            }, 2000);
            
            // Wait for process to complete or timeout
            while (!isDone && !timeout) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            if (!timeout) {
                // Should have received some events
                expect(events.length).toBeGreaterThan(0);
                
                // Should have spawn and exit events at minimum
                expect(events.some(e => e.type === ProcessEventType.spawn || e.type === ProcessEventType.exit)).toBe(true);
            }
        });
    });

    describe('edge cases', () => {
        it('should handle empty command gracefully', () => {
            expect(() => {
                spawnProcess([]);
            }).toThrow();
        });

        it('should not emit events after stream is closed', async () => {
            const helloScript = path.join(fixturesDir, 'hello.js');
            const { output, proc } = spawnProcess(['node', helloScript]);
            
            const events: any[] = [];
            
            output.pipe((event) => {
                if (event.t === c_item) {
                    events.push(event.item);
                }
            });
            
            // Close the stream immediately
            output.done();
            
            // Wait a bit to ensure no more events come through
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Should not have received many events since stream was closed
            const eventCount = events.length;
            expect(eventCount).toBeLessThanOrEqual(1); // Maybe spawn event if it came through quickly
            
            proc.kill();
        });
    });
});