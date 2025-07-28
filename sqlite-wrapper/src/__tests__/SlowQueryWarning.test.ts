import { SlowQueryWarning } from '../SlowQueryWarning';
import { describe, it, expect } from 'vitest';

describe('SlowQueryWarning', () => {
    it('should trigger warning for slow queries', async () => {
        let warningCalled = false;
        let warningMessage = '';
        
        const mockWarnCallback = (message: string) => {
            warningCalled = true;
            warningMessage = message;
        };

        const timer = new SlowQueryWarning('SELECT * FROM test', mockWarnCallback, 10); // 10ms threshold for testing
        
        // Simulate a slow operation
        await new Promise(resolve => setTimeout(resolve, 20)); // Wait 20ms to exceed the 10ms threshold
        timer.finish();
        
        expect(warningCalled).toBe(true);
        expect(warningMessage).toContain('Slow query detected');
        expect(warningMessage).toContain('SELECT * FROM test');
    });

    it('should not trigger warning for fast queries', () => {
        let warningCalled = false;
        
        const mockWarnCallback = (message: string) => {
            warningCalled = true;
        };

        const timer = new SlowQueryWarning('SELECT * FROM test', mockWarnCallback, 100); // 100ms threshold
        timer.finish(); // Finish immediately
        
        expect(warningCalled).toBe(false);
    });
});