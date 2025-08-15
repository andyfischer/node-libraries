import { Stream } from '@andyfischer/streams';
import { SseFetchOptions } from './SseRequest';

const KnownEventTypes = ['item', 'fail', 'done'] as const;

class LineParser {
  private buffer: string = '';

  constructor() {}

  decode(value: string): string[] {
    this.buffer += value;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    return lines;
  }
}

export class SseStreamParser<ResponseType> {
  private lineParser = new LineParser();
  private currentEventType: string | null = null;
  private options: SseFetchOptions;
  private stream: Stream<ResponseType>;

  constructor(stream: Stream<ResponseType>, options: SseFetchOptions) {
    this.stream = stream;
    this.options = options;
  }

  parseChunk(text: string): void {
    const lines = this.lineParser.decode(text);

    for (const line of lines) {
      this.handleSSELine(line);
    }
  }

  // finish() - Called when the input data is done. Will close the stream.
  finish(): void {
    if (!this.stream.isClosed()) {
      this.stream.done();
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
          this.options.onProtocolError?.(
            `Unknown event type from SSE response${this.options.url ? ` (${this.options.url})` : ''}: ${this.currentEventType}`
          );
        }
        break;

      case 'data': {
        switch (this.currentEventType) {
          case 'item':
            this.stream.item(JSON.parse(value));
            break;

          case 'fail': {
            const errorData = JSON.parse(value);
            if (!this.stream.isClosed()) {
              this.stream.fail(errorData);
            }
            break;
          }

          case 'done':
            if (!this.stream.isClosed()) {
              this.stream.done();
            }
            break;

          default:
            this.options.onProtocolError?.(
              `Unknown event type from SSE response${this.options.url ? ` (${this.options.url})` : ''}: ${this.currentEventType}`
            );
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
}
