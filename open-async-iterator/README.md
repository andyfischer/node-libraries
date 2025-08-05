# open-async-iterator

A utility for creating async iterators that can be controlled externally. This allows you to create an async iterator where you can push values to it from outside the iteration loop.

## Installation

```bash
npm install @andyfischer/open-async-iterator
```

## Usage

```typescript
import { openAsyncIterator } from '@andyfischer/open-async-iterator'

// Create an open async iterator
const { send, done, iterator } = openAsyncIterator<number>()

// Send values to the iterator
send(1)
send(2)
send(3)

// Mark the iterator as done
done()

// Consume the iterator
for await (const value of iterator) {
  console.log(value) // Outputs: 1, 2, 3
}
```

## API

### `openAsyncIterator<T>()`

Creates a new open async iterator.

**Returns:**
- `send(value: T)` - Function to send a value to the iterator
- `done()` - Function to mark the iterator as complete
- `iterator` - The async iterator object

### Error Handling

Calling `send()` after `done()` will throw an error:

```typescript
const { send, done } = openAsyncIterator()

done()
send(1) // Throws: "usage error: called send() after done()"
```

## Use Cases

- Creating async iterators from callback-based APIs
- Converting event streams to async iterators
- Building custom async data sources
- Bridging between push-based and pull-based async patterns

## License

MIT