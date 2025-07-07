import { describe, it, expect, vi } from 'vitest';
import { unixPipeToLines } from '../index';
import { EventEmitter } from 'events';
describe('unixPipeToLines', () => {
    it('should process single line with newline', () => {
        const mockStream = new EventEmitter();
        const lines: (string | null)[] = [];
        unixPipeToLines(mockStream as any, (line) => {
            lines.push(line);
        });
        mockStream.emit('data', Buffer.from('Hello World\n'));
        expect(lines).toEqual(['Hello World']);
    });
    it('should process multiple lines', () => {
        const mockStream = new EventEmitter();
        const lines: (string | null)[] = [];
        unixPipeToLines(mockStream as any, (line) => {
            lines.push(line);
        });
        mockStream.emit('data', Buffer.from('Line 1\nLine 2\nLine 3\n'));
        expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });
    it('should handle partial lines across multiple data events', () => {
        const mockStream = new EventEmitter();
        const lines: (string | null)[] = [];
        unixPipeToLines(mockStream as any, (line) => {
            lines.push(line);
        });
        mockStream.emit('data', Buffer.from('Hello '));
        mockStream.emit('data', Buffer.from('World\n'));
        expect(lines).toEqual(['Hello World']);
    });
    it('should handle lines without trailing newline', () => {
        const mockStream = new EventEmitter();
        const lines: (string | null)[] = [];
        unixPipeToLines(mockStream as any, (line) => {
            lines.push(line);
        });
        mockStream.emit('data', Buffer.from('Line 1\nLine 2'));
        mockStream.emit('close');
        expect(lines).toEqual(['Line 1', 'Line 2', null]);
    });
    it('should handle empty lines correctly', () => {
        const mockStream = new EventEmitter();
        const lines: (string | null)[] = [];
        unixPipeToLines(mockStream as any, (line) => {
            lines.push(line);
        });
        mockStream.emit('data', Buffer.from('Line 1\n\nLine 3\n'));
        expect(lines).toEqual(['Line 1', 'Line 3']);
    });
    it('should emit null on close', () => {
        const mockStream = new EventEmitter();
        const lines: (string | null)[] = [];
        unixPipeToLines(mockStream as any, (line) => {
            lines.push(line);
        });
        mockStream.emit('close');
        expect(lines).toEqual([null]);
    });
    it('should handle single newline character', () => {
        const mockStream = new EventEmitter();
        const lines: (string | null)[] = [];
        unixPipeToLines(mockStream as any, (line) => {
            lines.push(line);
        });
        mockStream.emit('data', Buffer.from('Hello'));
        mockStream.emit('data', Buffer.from('\n'));
        expect(lines).toEqual(['Hello']);
    });
    it('should handle multiple partial lines', () => {
        const mockStream = new EventEmitter();
        const lines: (string | null)[] = [];
        unixPipeToLines(mockStream as any, (line) => {
            lines.push(line);
        });
        mockStream.emit('data', Buffer.from('Part1'));
        mockStream.emit('data', Buffer.from(' Part2'));
        mockStream.emit('data', Buffer.from(' Part3\nLine2'));
        mockStream.emit('close');
        expect(lines).toEqual(['Part1 Part2 Part3', 'Line2', null]);
    });
    it('should handle UTF-8 encoded data correctly', () => {
        const mockStream = new EventEmitter();
        const lines: (string | null)[] = [];
        unixPipeToLines(mockStream as any, (line) => {
            lines.push(line);
        });
        mockStream.emit('data', Buffer.from('Hello 世界\nПривет мир\n'));
        expect(lines).toEqual(['Hello 世界', 'Привет мир']);
    });
    it('should handle edge case of only newline in data event after partial line', () => {
        const mockStream = new EventEmitter();
        const lines: (string | null)[] = [];
        unixPipeToLines(mockStream as any, (line) => {
            lines.push(line);
        });
        mockStream.emit('data', Buffer.from('Partial'));
        mockStream.emit('data', Buffer.from('\n'));
        mockStream.emit('close');
        expect(lines).toEqual(['Partial', null]);
    });
});
