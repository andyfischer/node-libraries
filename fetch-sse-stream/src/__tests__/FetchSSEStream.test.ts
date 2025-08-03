import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FetchSSEStream, fetchStream } from '../FetchSSEStream';
import { c_fail, exceptionIsBackpressureStop } from '@andyfischer/streams';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('FetchSSEStream', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should create a stream instance', () => {
        const client = new FetchSSEStream('http://example.com/events');
        expect(client).toBeInstanceOf(FetchSSEStream);
    });

    it('should throw error when connecting twice', () => {
        const client = new FetchSSEStream('http://example.com/events');
        client.connect();
        
        expect(() => client.connect()).toThrow('Stream already connected');
    });

    it('should parse SSE item events', async () => {
        const sseData = 'event: item\ndata: {"message": "hello world", "id": 123}\n\n';
        
        const mockReader = {
            read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(sseData) })
                .mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: vi.fn()
        };

        const mockResponse = {
            ok: true,
            body: {
                getReader: () => mockReader
            }
        };

        mockFetch.mockResolvedValueOnce(mockResponse);

        const stream = fetchStream<{message: string, id: number}>('http://example.com/events');
        const events = await stream.promiseItems();

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
            message: 'hello world',
            id: 123
        });
    });

    it('should handle multiple items in sequence', async () => {
        const sseData = 'event: item\ndata: {"value": 1}\n\nevent: item\ndata: {"value": 2}\n\n';
        
        const mockReader = {
            read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(sseData) })
                .mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: vi.fn()
        };

        const mockResponse = {
            ok: true,
            body: {
                getReader: () => mockReader
            }
        };

        mockFetch.mockResolvedValueOnce(mockResponse);

        const stream = fetchStream<{value: number}>('http://example.com/events');
        const events = await stream.promiseItems();

        expect(events).toHaveLength(2);
        expect(events[0]).toEqual({ value: 1 });
        expect(events[1]).toEqual({ value: 2 });
    });

    it('should handle fail events', async () => {
        const sseData = 'event: fail\ndata: {"message": "Something went wrong", "code": 500}\n\n';
        
        const mockReader = {
            read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(sseData) })
                .mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: vi.fn()
        };

        const mockResponse = {
            ok: true,
            body: {
                getReader: () => mockReader
            }
        };

        mockFetch.mockResolvedValueOnce(mockResponse);

        const stream = fetchStream('http://example.com/events');
        
        const events: any = await stream.promiseEvents();
        expect(events[0].t).toEqual(c_fail);
        expect(events[0].error as any).toEqual({
            message: 'Something went wrong',
            code: 500
        });
    });

    it('should handle done events', async () => {
        const sseData = 'event: item\ndata: {"value": 42}\n\nevent: done\n\n';
        
        const mockReader = {
            read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(sseData) })
                .mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: vi.fn()
        };

        const mockResponse = {
            ok: true,
            body: {
                getReader: () => mockReader
            }
        };

        mockFetch.mockResolvedValueOnce(mockResponse);

        const stream = fetchStream<{value: number}>('http://example.com/events');
        const events = await stream.promiseItems();

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({ value: 42 });
    });

    it('should handle comments and empty lines', async () => {
        const sseData = ': this is a comment\n\nevent: item\ndata: {"value": 42}\n\n: another comment\n\n';
        
        const mockReader = {
            read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(sseData) })
                .mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: vi.fn()
        };

        const mockResponse = {
            ok: true,
            body: {
                getReader: () => mockReader
            }
        };

        mockFetch.mockResolvedValueOnce(mockResponse);

        const stream = fetchStream<{value: number}>('http://example.com/events');
        const events = await stream.promiseItems();

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({ value: 42 });
    });

    it('should handle HTTP errors', async () => {
        const mockResponse = {
            ok: false,
            status: 404,
            statusText: 'Not Found'
        };

        mockFetch.mockResolvedValueOnce(mockResponse);

        const stream = fetchStream('http://example.com/events');
        
        await expect(stream.promiseItems()).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should set correct headers', async () => {
        const mockReader = {
            read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: vi.fn()
        };

        const mockResponse = {
            ok: true,
            body: {
                getReader: () => mockReader
            }
        };

        mockFetch.mockResolvedValueOnce(mockResponse);

        fetchStream('http://example.com/events');

        expect(mockFetch).toHaveBeenCalledWith('http://example.com/events', expect.objectContaining({
            headers: expect.objectContaining({
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache'
            })
        }));
    });

    it('should allow custom headers', async () => {
        const mockReader = {
            read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: vi.fn()
        };

        const mockResponse = {
            ok: true,
            body: {
                getReader: () => mockReader
            }
        };

        mockFetch.mockResolvedValueOnce(mockResponse);

        fetchStream('http://example.com/events', {
            headers: {
                'Authorization': 'Bearer token123'
            }
        });

        expect(mockFetch).toHaveBeenCalledWith('http://example.com/events', expect.objectContaining({
            headers: expect.objectContaining({
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Authorization': 'Bearer token123'
            })
        }));
    });

    it('should call onOpen callback when connection opens', async () => {
        const onOpen = vi.fn();
        const mockReader = {
            read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: vi.fn()
        };

        const mockResponse = {
            ok: true,
            body: {
                getReader: () => mockReader
            }
        };

        mockFetch.mockResolvedValueOnce(mockResponse);

        const stream = fetchStream('http://example.com/events', { onOpen });
        await stream.promiseItems();

        expect(onOpen).toHaveBeenCalledOnce();
    });

    it('should handle close method', () => {
        const client = new FetchSSEStream('http://example.com/events');
        const stream = client.connect();
        
        expect(() => client.close()).not.toThrow();
        expect(stream.isClosed()).toBe(true);
    });

    it('should handle lines without colons', async () => {
        const sseData = 'invalid-line\nevent: item\ndata: {"value": 123}\n\n';
        
        const mockReader = {
            read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(sseData) })
                .mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: vi.fn()
        };

        const mockResponse = {
            ok: true,
            body: {
                getReader: () => mockReader
            }
        };

        mockFetch.mockResolvedValueOnce(mockResponse);

        const stream = fetchStream<{value: number}>('http://example.com/events');
        const events = await stream.promiseItems();

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({ value: 123 });
    });

    it('should handle unknown event types', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const sseData = 'event: unknown\ndata: {"value": 123}\n\n';
        
        const mockReader = {
            read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(sseData) })
                .mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: vi.fn()
        };

        const mockResponse = {
            ok: true,
            body: {
                getReader: () => mockReader
            }
        };

        mockFetch.mockResolvedValueOnce(mockResponse);

        const stream = fetchStream('http://example.com/events');
        await stream.promiseItems();

        expect(consoleSpy).toHaveBeenCalledWith('Unknown event type from SSE response (http://example.com/events): unknown');
        consoleSpy.mockRestore();
    });

    it('should handle null response body', async () => {
        const mockResponse = {
            ok: true,
            body: null
        };

        mockFetch.mockResolvedValueOnce(mockResponse);

        const stream = fetchStream('http://example.com/events');
        
        await expect(stream.promiseItems()).rejects.toThrow('Response body is null');
    });

    it('should handle id and retry fields', async () => {
        const sseData = 'id: 123\nretry: 5000\nevent: item\ndata: {"value": 42}\n\n';
        
        const mockReader = {
            read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(sseData) })
                .mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: vi.fn()
        };

        const mockResponse = {
            ok: true,
            body: {
                getReader: () => mockReader
            }
        };

        mockFetch.mockResolvedValueOnce(mockResponse);

        const stream = fetchStream<{value: number}>('http://example.com/events');
        const events = await stream.promiseItems();

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({ value: 42 });
    });

    it('should use custom fetch function when provided', async () => {
        const customFetch = vi.fn();
        const sseData = 'event: item\ndata: {"value": 123}\n\n';
        
        const mockReader = {
            read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(sseData) })
                .mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: vi.fn()
        };

        const mockResponse = {
            ok: true,
            body: {
                getReader: () => mockReader
            }
        };

        customFetch.mockResolvedValueOnce(mockResponse);

        const stream = fetchStream<{value: number}>('http://example.com/events', {
            fetch: customFetch
        });
        const events = await stream.promiseItems();

        expect(customFetch).toHaveBeenCalledWith('http://example.com/events', expect.objectContaining({
            headers: expect.objectContaining({
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache'
            })
        }));
        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({ value: 123 });
    });
});