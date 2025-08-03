# @andyfischer/fetch-sse-stream

HTTP client using `fetch` with Server-Sent Events (SSE) parsing.

One fetch call will return a `Stream` object from @andyfischer/streams.

## Installation

```bash
npm install @andyfischer/fetch-sse-stream
```

## Usage

### Basic Usage

```typescript
import { fetchStream } from '@andyfischer/fetch-sse-stream';
import { c_item, c_fail, c_done } from '@andyfischer/streams';

const stream = fetchStream<ResponseType>('https://example.com/events');

// Process events as they arrive
stream.pipe(evt => {
    switch (evt.t) {
    case c_item:
        const item: ResponseType = evt.item;
        // ...
        break;
    case c_fail:
        // ...
        break;
    case c_done:
        // ...
        break;
    }
});
```

### Advanced Usage

Set custom headers in the request.

```typescript
import { fetchStream } from '@andyfischer/fetch-sse-stream';

const stream = fetchStream('https://example.com/events', {
    headers: {
        'Authorization': 'Bearer your-token'
    },
    onOpen: () => console.log('Connected'),
    onError: (error) => console.error('Connection error:', error)
});

// Process the stream
stream.pipe(evt => {
    // Handle events...
});
```

### Using a Custom Fetch Function

You can provide your own fetch implementation (useful for testing, proxies, or custom authentication):

```typescript
import { fetchStream } from '@andyfischer/fetch-sse-stream';
import nodeFetch from 'node-fetch';

const stream = fetchStream('https://example.com/events', {
    fetch: nodeFetch as any, // Use node-fetch instead of built-in fetch
    headers: {
        'User-Agent': 'MyApp/1.0'
    }
});
```

## API

### `fetchStream(url, options?)`

Creates and connects to an SSE stream immediately.

- `url`: The endpoint URL
- `options`: Optional configuration (extends `RequestInit`)

Returns a `Stream<SSEEventData>` from `@andyfischer/streams`.

### `FetchSSEStream`

Class for more control over the connection lifecycle.

#### Constructor Options

- `onOpen`: Callback when connection opens
- `onError`: Callback for connection errors
- `fetch`: Custom fetch function to use instead of global fetch
- Plus all standard `RequestInit` options (headers, method, etc.)

#### Methods

- `connect()`: Start the connection and return the Stream
- `close()`: Close the connection and cleanup resources
