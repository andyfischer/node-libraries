import { exceptionIsBackpressureStop, Stream } from '@andyfischer/streams';
import { SseStreamParser } from './SseStreamParser.js';

export interface SseFetchOptions extends RequestInit {
  url: string;
  onOpen?: () => void;
  onProtocolError?: (msg: string) => void;
  fetch?: typeof fetch;
}

export class SseRequest<ResponseType> {
  private options: SseFetchOptions;
  private abortController: AbortController | null = null;
  private sseParser: SseStreamParser<ResponseType> | null = null;
  private stream = new Stream<ResponseType>()

  constructor(options: SseFetchOptions) {
    this.options = {
      ...options,
    };
  }

  connect(): Stream<ResponseType> {
    if (this.sseParser) {
      throw new Error('Stream already connected');
    }

    this.abortController = new AbortController();
    this.sseParser = new SseStreamParser<ResponseType>(this.stream, this.options);

    this.runConnection();

    return this.stream;
  }

  private async runConnection() {
    try {
      const fetchFn = this.options.fetch || fetch;

      const response = await fetchFn(this.options.url, {
        ...this.options,
        signal: this.abortController?.signal,
        headers: {
          Accept: 'text/event-stream',
          ...this.options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      if (this.options.onOpen) {
        this.options.onOpen();
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();

        if (this.stream.isClosed()) {
          break;
        }
        
        if (done) {
          this.stream.done();
          break;
        }

        const text = decoder.decode(value, { stream: true });
        this.sseParser.parseChunk(text);

      }
    } catch (error) {
      this.abortController?.abort();

      if (exceptionIsBackpressureStop(error)) {
        this.stream.stopListening();
        return;
      }

      if (!this.stream.isClosed()) {
        this.stream.fail(error as Error);
      }
    }
  }

  close() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.stream.stopListening();
  }
}

export function fetchSseStream<ResponseType>(options: SseFetchOptions): Stream<ResponseType> {
  const client = new SseRequest<ResponseType>(options);
  return client.connect();
}
