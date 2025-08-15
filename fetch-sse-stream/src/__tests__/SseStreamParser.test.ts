import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SseStreamParser } from '../SseStreamParser';
import { Stream } from '@andyfischer/streams';

describe('SseStreamParser', () => {
  let stream: Stream<any>;
  let onProtocolError: ReturnType<typeof vi.fn>;
  let parser: SseStreamParser<any>;

  beforeEach(() => {
    stream = new Stream();
    onProtocolError = vi.fn();
    parser = new SseStreamParser(stream, {
      url: 'https://example.com/events',
      onProtocolError
    });
  });

  describe('parseChunk', () => {
    it('should parse single item event', () => {
      const items: any[] = [];
      stream.listen({
        item: (item) => items.push(item)
      });

      parser.parseChunk('event: item\ndata: {"id":1,"value":"test"}\n\n');
      
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({ id: 1, value: 'test' });
    });

    it('should parse multiple item events', () => {
      const items: any[] = [];
      stream.listen({
        item: (item) => items.push(item)
      });

      parser.parseChunk('event: item\ndata: {"id":1}\n\nevent: item\ndata: {"id":2}\n\n');
      
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({ id: 1 });
      expect(items[1]).toEqual({ id: 2 });
    });

    it('should handle fail events', () => {
      const errors: any[] = [];
      stream.listen({
        fail: (error) => errors.push(error)
      });

      parser.parseChunk('event: fail\ndata: {"message":"Something went wrong","code":"ERR_001"}\n\n');
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({ message: 'Something went wrong', code: 'ERR_001' });
    });

    it('should handle done events', () => {
      let isDone = false;
      stream.listen({
        done: () => { isDone = true; }
      });

      parser.parseChunk('event: done\ndata: {}\n\n');
      
      expect(isDone).toBe(true);
    });

    it('should handle chunks split across parseChunk calls', () => {
      const items: any[] = [];
      stream.listen({
        item: (item) => items.push(item)
      });

      parser.parseChunk('event: item\ndata: {"id"');
      parser.parseChunk(':1,"value":"test"}\n\n');
      
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({ id: 1, value: 'test' });
    });

    it('should handle lines split across chunks', () => {
      const items: any[] = [];
      stream.listen({
        item: (item) => items.push(item)
      });

      parser.parseChunk('event: ');
      parser.parseChunk('item\n');
      parser.parseChunk('data: {"id":1}\n\n');
      
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({ id: 1 });
    });

    it('should ignore comment lines starting with colon', () => {
      const items: any[] = [];
      stream.listen({
        item: (item) => items.push(item)
      });

      parser.parseChunk(': this is a comment\nevent: item\ndata: {"id":1}\n\n');
      
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({ id: 1 });
    });

    it('should ignore empty lines', () => {
      const items: any[] = [];
      stream.listen({
        item: (item) => items.push(item)
      });

      parser.parseChunk('\n\nevent: item\ndata: {"id":1}\n\n');
      
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({ id: 1 });
    });

    it('should ignore lines without colons', () => {
      const items: any[] = [];
      stream.listen({
        item: (item) => items.push(item)
      });

      parser.parseChunk('invalid line\nevent: item\ndata: {"id":1}\n\n');
      
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({ id: 1 });
    });

    it('should handle id and retry fields without errors', () => {
      const items: any[] = [];
      stream.listen({
        item: (item) => items.push(item)
      });

      parser.parseChunk('id: 123\nretry: 5000\nevent: item\ndata: {"id":1}\n\n');
      
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({ id: 1 });
    });

    it('should reset event type on empty line', () => {
      const items: any[] = [];
      stream.listen({
        item: (item) => items.push(item)
      });

      parser.parseChunk('event: item\n\ndata: {"id":1}\n\n');
      
      // Data without event type should trigger protocol error
      expect(onProtocolError).toHaveBeenCalled();
    });

    it('should report unknown event types', () => {
      parser.parseChunk('event: unknown\ndata: {"test":1}\n\n');
      
      expect(onProtocolError).toHaveBeenCalledWith(
        'Unknown event type from SSE response (https://example.com/events): unknown'
      );
    });

    it('should handle malformed JSON gracefully', () => {
      const errors: any[] = [];
      stream.listen({
        fail: (error) => errors.push(error)
      });

      expect(() => {
        parser.parseChunk('event: item\ndata: {invalid json}\n\n');
      }).toThrow(); // JSON.parse will throw, which should be caught by SseRequest
    });

    it('should handle data with spaces after colon', () => {
      const items: any[] = [];
      stream.listen({
        item: (item) => items.push(item)
      });

      parser.parseChunk('event:   item\ndata:   {"id":1}\n\n');
      
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({ id: 1 });
    });

    it('should handle multiple data fields for same event', () => {
      const items: any[] = [];
      stream.listen({
        item: (item) => items.push(item)
      });

      // Each data field should trigger a separate item
      parser.parseChunk('event: item\ndata: {"id":1}\ndata: {"id":2}\n\n');
      
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({ id: 1 });
      expect(items[1]).toEqual({ id: 2 });
    });
  });

  describe('finish', () => {
    it('should close the stream if not already closed', () => {
      let isDone = false;
      stream.listen({
        done: () => { isDone = true; }
      });

      parser.finish();
      
      expect(isDone).toBe(true);
    });

    it('should not close an already closed stream', () => {
      stream.done();
      
      const doneSpy = vi.spyOn(stream, 'done');
      parser.finish();
      
      expect(doneSpy).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should call onProtocolError for unknown event after data', () => {
      parser.parseChunk('event: unknown\ndata: {"test":1}\n\n');
      
      expect(onProtocolError).toHaveBeenCalledTimes(2); // Once for event, once for data
    });

    it('should handle onProtocolError not being provided', () => {
      const parserWithoutCallback = new SseStreamParser(stream, {
        url: 'https://example.com/events'
      });

      expect(() => {
        parserWithoutCallback.parseChunk('event: unknown\ndata: {"test":1}\n\n');
      }).not.toThrow();
    });

    it('should include URL in error message when available', () => {
      parser.parseChunk('event: unknown\ndata: {}\n\n');
      
      expect(onProtocolError).toHaveBeenCalledWith(
        expect.stringContaining('(https://example.com/events)')
      );
    });

    it('should not include URL when not provided', () => {
      const parserWithoutUrl = new SseStreamParser(stream, {
        url: '',
        onProtocolError
      });

      parserWithoutUrl.parseChunk('event: unknown\ndata: {}\n\n');
      
      expect(onProtocolError).toHaveBeenCalledWith(
        expect.not.stringContaining('()')
      );
    });
  });

  describe('complex scenarios', () => {
    it('should handle a real-world SSE stream', () => {
      const items: any[] = [];
      const errors: any[] = [];
      let isDone = false;

      stream.listen({
        item: (item) => items.push(item),
        fail: (error) => errors.push(error),
        done: () => { isDone = true; }
      });

      // Simulate a realistic SSE stream with comments, various events, and formatting
      const sseData = 
        ': Starting stream\n' +
        'retry: 1000\n' +
        '\n' +
        'event: item\n' +
        'id: msg-001\n' +
        'data: {"type":"message","content":"Hello"}\n' +
        '\n' +
        'event: item\n' +
        'id: msg-002\n' +
        'data: {"type":"message","content":"World"}\n' +
        '\n' +
        ': Midpoint comment\n' +
        'event: item\n' +
        'data: {"type":"status","value":"processing"}\n' +
        '\n' +
        'event: fail\n' +
        'data: {"error":"Network timeout","retry":true}\n' +
        '\n' +
        'event: done\n' +
        'data: {}\n' +
        '\n';

      parser.parseChunk(sseData);

      expect(items).toHaveLength(3);
      expect(items[0]).toEqual({ type: 'message', content: 'Hello' });
      expect(items[1]).toEqual({ type: 'message', content: 'World' });
      expect(items[2]).toEqual({ type: 'status', value: 'processing' });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({ error: 'Network timeout', retry: true });
      
      expect(isDone).toBe(false);
    });

    it('should handle extremely fragmented input', () => {
      const items: any[] = [];
      stream.listen({
        item: (item) => items.push(item)
      });

      // Send one character at a time
      const data = 'event: item\ndata: {"id":1}\n\n';
      for (const char of data) {
        parser.parseChunk(char);
      }

      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({ id: 1 });
    });

    it('should handle mixed line endings', () => {
      const items: any[] = [];
      stream.listen({
        item: (item) => items.push(item)
      });

      // Mix of \n, \r\n line endings
      parser.parseChunk('event: item\r\ndata: {"id":1}\r\n\r\n');
      parser.parseChunk('event: item\ndata: {"id":2}\n\n');

      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({ id: 1 });
      expect(items[1]).toEqual({ id: 2 });
    });
  });
});

describe('LineParser (internal)', () => {
  it('should buffer incomplete lines', () => {
    const parser = new SseStreamParser(new Stream(), { url: '' });
    const items: any[] = [];
    const stream = new Stream();
    stream.listen({
      item: (item) => items.push(item)
    });

    const testParser = new SseStreamParser(stream, { url: '' });

    testParser.parseChunk('event: item\ndata: {"i');
    testParser.parseChunk('d":1}\n\n');

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ id: 1 });
  });

  it('should handle empty chunks', () => {
    const stream = new Stream();
    const parser = new SseStreamParser(stream, { url: '' });

    expect(() => {
      parser.parseChunk('');
    }).not.toThrow();
  });

  it('should preserve trailing partial lines', () => {
    const items: any[] = [];
    const stream = new Stream();
    stream.listen({
      item: (item) => items.push(item)
    });

    const parser = new SseStreamParser(stream, { url: '' });

    parser.parseChunk('event: item\ndata: {"id":1}\n\nevent: it');
    expect(items).toHaveLength(1);

    parser.parseChunk('em\ndata: {"id":2}\n\n');
    expect(items).toHaveLength(2);
    expect(items[1]).toEqual({ id: 2 });
  });
});