import { exceptionIsBackpressureStop, Stream } from '@andyfischer/streams';

export interface FetchSSEOptions extends RequestInit {
    onOpen?: () => void;
    onError?: (error: Error) => void;
    fetch?: typeof fetch;
}

class LineParser {
    private buffer: string = '';

    constructor() {
    }

    decode(value: string): string[] {
        this.buffer += value;
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';
        return lines;
    }
}

const KnownEventTypes = ['item', 'fail', 'done'] as const;

export class FetchSSEStream<ResponseType> {
    private url: string;
    private options: FetchSSEOptions;
    private stream: Stream<ResponseType> | null = null;
    private abortController: AbortController | null = null;
    private currentEventType: string | null = null;

    constructor(url: string, options: FetchSSEOptions = {}) {
        this.url = url;
        this.options = {
            ...options
        };
    }

    connect(): Stream<ResponseType> {
        if (this.stream) {
            throw new Error('Stream already connected');
        }

        this.stream = new Stream<ResponseType>();
        this.abortController = new AbortController();
        
        this.runConnection();
        
        return this.stream;
    }

    private async runConnection() {
        try {
            const fetchFn = this.options.fetch || fetch;
            const response = await fetchFn(this.url, {
                ...this.options,
                signal: this.abortController?.signal,
                headers: {
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    ...this.options.headers
                }
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
            const lineParser = new LineParser();

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    if (this.stream && !this.stream.isClosed()) {
                        this.stream.done();
                    }
                    break;
                }

                const text = decoder.decode(value, { stream: true });
                const lines = lineParser.decode(text);

                for (const line of lines) {
                    this.handleSSELine(line);
                }
            }

        } catch (error) {
            if (exceptionIsBackpressureStop(error)) {
                this.abortController?.abort();
                return;
            }

            this.abortController?.abort();
            if (this.stream && !this.stream.isClosed()) {
                this.stream.fail(error as Error);
            }
        }
    }

    private handleSSELine(line: string) {
        if (line.trim() === '') {
            this.currentEventType = null;
            return;
        }

        if (line.startsWith(':')) {
            return;
        }

        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) {
            return;
        }

        const field = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();

        switch (field) {
            case 'event':
                this.currentEventType = value;
                if (!KnownEventTypes.includes(this.currentEventType as any)) {
                    console.warn(`Unknown event type from SSE response (${this.url}): ${this.currentEventType}`);
                }
                break;
            case 'data': {
                switch (this.currentEventType) {
                    case 'item':
                        this.stream!.item(JSON.parse(value));
                        break;
                    case 'fail': {
                        const errorData = JSON.parse(value);
                        this.stream!.fail(errorData);
                        break;
                    }
                    case 'done':
                        this.stream!.done();
                        break;
                    default:
                        console.warn(`Unknown event type from SSE response (${this.url}): ${this.currentEventType}`);
                }
                break;
            }
            case 'id':
                // ignore
                break;
            case 'retry':
                // ignore
                break;
        }
    }

    close() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        
        if (this.stream && !this.stream.isClosed()) {
            this.stream.stopListening();
        }
        
        this.stream = null;
    }
}

export function fetchStream<ResponseType>(url: string, options?: FetchSSEOptions): Stream<ResponseType> {
    const client = new FetchSSEStream<ResponseType>(url, options);
    return client.connect();
}