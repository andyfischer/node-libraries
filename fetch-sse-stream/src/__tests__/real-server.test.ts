import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server } from 'http';
import { fetchSseStream } from '../index';

describe('Real HTTP Server Tests', () => {
  let server: Server;
  let port: number;
  let serverUrl: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/sse-clean-close') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });

        res.write(': Server started\n\n');
        res.write('event: item\ndata: {"id":1,"message":"First item"}\n\n');
        
        setTimeout(() => {
          res.write('event: item\ndata: {"id":2,"message":"Second item"}\n\n');
        }, 50);
        
        setTimeout(() => {
          res.write('event: done\ndata: {}\n\n');
          res.end();
        }, 100);
        
      } else if (req.url === '/sse-abrupt-close') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });

        res.write('event: item\ndata: {"id":1,"message":"Only item"}\n\n');
        
        setTimeout(() => {
          res.destroy();
        }, 50);
        
      } else if (req.url === '/sse-error-then-close') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });

        res.write('event: item\ndata: {"id":1,"message":"First item"}\n\n');
        
        setTimeout(() => {
          res.write('event: fail\ndata: {"error":"Something went wrong"}\n\n');
        }, 50);
        
        setTimeout(() => {
          res.end();
        }, 100);
        
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, 'localhost', () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          port = address.port;
          serverUrl = `http://localhost:${port}`;
        }
        resolve();
      });
    });
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should handle clean server closure', async () => {
    const items: any[] = [];
    const errors: any[] = [];
    let isDone = false;
    let isOpen = false;

    const stream = fetchSseStream({
      url: `${serverUrl}/sse-clean-close`,
      onOpen: () => { isOpen = true; }
    });

    stream.listen({
      item: (item) => items.push(item),
      fail: (error) => errors.push(error),
      done: () => { isDone = true; }
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(isOpen).toBe(true);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ id: 1, message: 'First item' });
    expect(items[1]).toEqual({ id: 2, message: 'Second item' });
    expect(errors).toHaveLength(0);
    expect(isDone).toBe(true);
  });

  it('should handle abrupt server connection close', async () => {
    const items: any[] = [];
    const errors: any[] = [];
    let isDone = false;

    const stream = fetchSseStream({
      url: `${serverUrl}/sse-abrupt-close`
    });

    stream.listen({
      item: (item) => items.push(item),
      fail: (error) => errors.push(error),
      done: () => { isDone = true; }
    });

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ id: 1, message: 'Only item' });
    expect(errors).toHaveLength(0);
    expect(isDone).toBe(true);
  });

  it('should handle server error followed by clean close', async () => {
    const items: any[] = [];
    const errors: any[] = [];
    let isDone = false;

    const stream = fetchSseStream({
      url: `${serverUrl}/sse-error-then-close`
    });

    stream.listen({
      item: (item) => items.push(item),
      fail: (error) => errors.push(error),
      done: () => { isDone = true; }
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ id: 1, message: 'First item' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({ error: 'Something went wrong' });
    expect(isDone).toBe(false);
    expect(stream.isClosed()).toBe(true);
  });

  it('should properly close stream when server sends done event', async () => {
    let streamClosed = false;
    
    const stream = fetchSseStream({
      url: `${serverUrl}/sse-clean-close`
    });

    stream.listen({
      done: () => { streamClosed = true; }
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(streamClosed).toBe(true);
    expect(stream.isClosed()).toBe(true);
  });
});