import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchSseStream } from '../index';

describe('Integration Tests', () => {
  let mockFetch: any;
  
  beforeEach(() => {
    mockFetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchSseStream end-to-end', () => {
    it('should handle a complete SSE session successfully', async () => {
      const chunks = [
        ': Server started\n\n',
        'event: item\ndata: {"id":1,"message":"First"}\n\n',
        'event: item\ndata: {"id":2,"message":"Second"}\n\n',
        'event: done\ndata: {}\n\n'
      ];

      let chunkIndex = 0;
      const encoder = new TextEncoder();
      
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => {
              if (chunkIndex < chunks.length) {
                const chunk = chunks[chunkIndex++];
                return Promise.resolve({
                  done: false,
                  value: encoder.encode(chunk)
                });
              }
              return Promise.resolve({ done: true });
            })
          })
        }
      });

      const items: any[] = [];
      const errors: any[] = [];
      let isDone = false;
      let isOpen = false;

      const stream = fetchSseStream({
        url: 'https://api.example.com/stream',
        fetch: mockFetch,
        onOpen: () => { isOpen = true; }
      });

      stream.listen({
        item: (item) => items.push(item),
        fail: (error) => errors.push(error),
        done: () => { isDone = true; }
      });

      // Wait for stream to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(isOpen).toBe(true);
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({ id: 1, message: 'First' });
      expect(items[1]).toEqual({ id: 2, message: 'Second' });
      expect(errors).toHaveLength(0);
      expect(isDone).toBe(true);
    });

    it('should handle server errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      });

      const errors: any[] = [];
      const items: any[] = [];

      const stream = fetchSseStream({
        url: 'https://api.example.com/stream',
        fetch: mockFetch
      });

      stream.listen({
        item: (item) => items.push(item),
        fail: (error) => errors.push(error)
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(items).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].errorMessage).toBe('HTTP 503: Service Unavailable');
    });

    it('should handle network failures', async () => {
      const networkError = new Error('Failed to fetch');
      mockFetch.mockRejectedValue(networkError);

      const errors: any[] = [];

      const stream = fetchSseStream({
        url: 'https://api.example.com/stream',
        fetch: mockFetch
      });

      stream.listen({
        fail: (error) => errors.push(error)
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(errors).toHaveLength(1);
      expect(errors[0].errorMessage).toBe('Failed to fetch');
    });

    it('should handle stream with errors in the middle', async () => {
      const chunks = [
        'event: item\ndata: {"id":1}\n\n',
        'event: fail\ndata: {"message":"Temporary error","code":"TEMP_001"}\n\n',
        'event: item\ndata: {"id":2}\n\n',
        'event: done\ndata: {}\n\n'
      ];

      let chunkIndex = 0;
      const encoder = new TextEncoder();
      
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => {
              if (chunkIndex < chunks.length) {
                const chunk = chunks[chunkIndex++];
                return Promise.resolve({
                  done: false,
                  value: encoder.encode(chunk)
                });
              }
              return Promise.resolve({ done: true });
            })
          })
        }
      });

      const items: any[] = [];
      const errors: any[] = [];
      let isDone = false;

      const stream = fetchSseStream({
        url: 'https://api.example.com/stream',
        fetch: mockFetch
      });

      stream.listen({
        item: (item) => items.push(item),
        fail: (error) => errors.push(error),
        done: () => { isDone = true; }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({ id: 1 });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({ message: 'Temporary error', code: 'TEMP_001' });
      expect(isDone).toBe(false);
    });

    it('should handle protocol errors', async () => {
      const protocolErrors: string[] = [];
      
      const chunks = [
        'event: unknown_event\ndata: {"test":1}\n\n',
        'event: item\ndata: {"id":1}\n\n'
      ];

      let chunkIndex = 0;
      const encoder = new TextEncoder();
      
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => {
              if (chunkIndex < chunks.length) {
                const chunk = chunks[chunkIndex++];
                return Promise.resolve({
                  done: false,
                  value: encoder.encode(chunk)
                });
              }
              return Promise.resolve({ done: true });
            })
          })
        }
      });

      const items: any[] = [];

      const stream = fetchSseStream({
        url: 'https://api.example.com/stream',
        fetch: mockFetch,
        onProtocolError: (msg) => protocolErrors.push(msg)
      });

      stream.listen({
        item: (item) => items.push(item)
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(protocolErrors.length).toBeGreaterThan(0);
      expect(protocolErrors[0]).toContain('unknown_event');
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({ id: 1 });
    });

    it('should handle abrupt connection close', async () => {
      const readerError = new Error('Connection closed');
      
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('event: item\ndata: {"id":1}\n\n')
              })
              .mockRejectedValue(readerError)
          })
        }
      });

      const items: any[] = [];
      const errors: any[] = [];
      let isDone = false;

      const stream = fetchSseStream({
        url: 'https://api.example.com/stream',
        fetch: mockFetch
      });

      stream.listen({
        item: (item) => items.push(item),
        fail: (error) => errors.push(error),
        done: () => { isDone = true; }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(items).toHaveLength(1);
      expect(errors).toHaveLength(0);
      expect(isDone).toBe(true);
    });

    it('should handle custom headers and options', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockResolvedValue({ done: true })
          })
        }
      });

      fetchSseStream({
        url: 'https://api.example.com/stream',
        fetch: mockFetch,
        method: 'POST',
        headers: {
          'Authorization': 'Bearer token123',
          'X-Custom-Header': 'custom-value'
        },
        body: JSON.stringify({ subscribe: true })
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/stream',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Accept': 'text/event-stream',
            'Authorization': 'Bearer token123',
            'X-Custom-Header': 'custom-value'
          }),
          body: JSON.stringify({ subscribe: true })
        })
      );
    });

    it('should handle slow/chunked responses', async () => {
      // Simulate data arriving in small, incomplete chunks
      const fullMessage = 'event: item\ndata: {"id":1,"content":"This is a longer message that will be split"}\n\n';
      const chunkSize = 10;
      const chunks: string[] = [];
      
      for (let i = 0; i < fullMessage.length; i += chunkSize) {
        chunks.push(fullMessage.slice(i, i + chunkSize));
      }

      let chunkIndex = 0;
      const encoder = new TextEncoder();
      
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => {
              if (chunkIndex < chunks.length) {
                const chunk = chunks[chunkIndex++];
                return Promise.resolve({
                  done: false,
                  value: encoder.encode(chunk)
                });
              }
              return Promise.resolve({ done: true });
            })
          })
        }
      });

      const items: any[] = [];

      const stream = fetchSseStream({
        url: 'https://api.example.com/stream',
        fetch: mockFetch
      });

      stream.listen({
        item: (item) => items.push(item)
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({
        id: 1,
        content: 'This is a longer message that will be split'
      });
    });

    it('should not leak memory on early close', async () => {
      let readCallCount = 0;
      
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => {
              readCallCount++;
              // Simulate infinite stream
              return new Promise((resolve) => {
                setTimeout(() => {
                  resolve({
                    done: false,
                    value: new TextEncoder().encode(`event: item\ndata: {"count":${readCallCount}}\n\n`)
                  });
                }, 10);
              });
            })
          })
        }
      });

      const items: any[] = [];

      const stream = fetchSseStream({
        url: 'https://api.example.com/stream',
        fetch: mockFetch
      });

      stream.listen({
        item: (item) => {
          items.push(item);
          if (items.length >= 3) {
            // Close the stream after 3 items
            stream.stopListening();
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Stream should stop reading after being closed
      expect(items.length).toBeGreaterThanOrEqual(3);
      expect(items.length).toBeLessThan(10); // Should not continue indefinitely
    });

    it('should handle malformed JSON without crashing entire stream', async () => {
      const chunks = [
        'event: item\ndata: {"id":1}\n\n',
        'event: item\ndata: {malformed json}\n\n', // This will cause JSON.parse error
        'event: item\ndata: {"id":3}\n\n'
      ];

      let chunkIndex = 0;
      const encoder = new TextEncoder();
      
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => {
              if (chunkIndex < chunks.length) {
                const chunk = chunks[chunkIndex++];
                return Promise.resolve({
                  done: false,
                  value: encoder.encode(chunk)
                });
              }
              return Promise.resolve({ done: true });
            })
          })
        }
      });

      const items: any[] = [];
      const errors: any[] = [];

      const stream = fetchSseStream({
        url: 'https://api.example.com/stream',
        fetch: mockFetch
      });

      stream.listen({
        item: (item) => items.push(item),
        fail: (error) => errors.push(error)
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // The malformed JSON should cause an error on the stream
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].errorMessage).toContain('JSON');
    });
  });

  describe('Stream API compatibility', () => {
    it('should work with Stream.toArray()', async () => {
      const testData = [
        { id: 1, value: 'first' },
        { id: 2, value: 'second' },
        { id: 3, value: 'third' }
      ];

      const chunks = testData.map(item => 
        `event: item\ndata: ${JSON.stringify(item)}\n\n`
      ).concat(['event: done\ndata: {}\n\n']);

      let chunkIndex = 0;
      const encoder = new TextEncoder();
      
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => {
              if (chunkIndex < chunks.length) {
                const chunk = chunks[chunkIndex++];
                return Promise.resolve({
                  done: false,
                  value: encoder.encode(chunk)
                });
              }
              return Promise.resolve({ done: true });
            })
          })
        }
      });

      const stream = fetchSseStream<{ id: number; value: string }>({
        url: 'https://api.example.com/stream',
        fetch: mockFetch
      });

      const results = await stream.promiseItems();
      
      expect(results).toEqual(testData);
    });

    it('should work with async iteration', async () => {
      const testData = [
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ];

      const chunks = testData.map(item => 
        `event: item\ndata: ${JSON.stringify(item)}\n\n`
      ).concat(['event: done\ndata: {}\n\n']);

      let chunkIndex = 0;
      const encoder = new TextEncoder();
      
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => {
              if (chunkIndex < chunks.length) {
                const chunk = chunks[chunkIndex++];
                return Promise.resolve({
                  done: false,
                  value: encoder.encode(chunk)
                });
              }
              return Promise.resolve({ done: true });
            })
          })
        }
      });

      const stream = fetchSseStream<{ id: number }>({
        url: 'https://api.example.com/stream',
        fetch: mockFetch
      });

      const results: any[] = [];
      for await (const item of stream) {
        results.push(item);
      }
      
      expect(results).toEqual(testData);
    });
  });
});