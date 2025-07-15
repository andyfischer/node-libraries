import { it, expect } from 'vitest'
import { callbackBasedIterator } from '../callbackBasedIterator'

it('creates iterator that yields sent items', async () => {
    const { send, done, it } = callbackBasedIterator<number>();
    
    send(1);
    send(2);
    send(3);
    done();
    
    const results = [];
    for await (const item of it) {
        results.push(item);
    }
    
    expect(results).toEqual([1, 2, 3]);
});

it('handles empty iterator', async () => {
    const { done, it } = callbackBasedIterator<number>();
    
    done();
    
    const results = [];
    for await (const item of it) {
        results.push(item);
    }
    
    expect(results).toEqual([]);
});

it('yields items in batches when sent together', async () => {
    const { send, done, it } = callbackBasedIterator<string>();
    
    send('a');
    send('b');
    send('c');
    done();
    
    const results = [];
    for await (const item of it) {
        results.push(item);
    }
    
    expect(results).toEqual(['a', 'b', 'c']);
});

it('throws error when sending after done', () => {
    const { send, done } = callbackBasedIterator<number>();
    
    done();
    
    expect(() => send(1)).toThrow('usage error: called send() after done()');
});

it('works with async iteration pattern', async () => {
    const { send, done, it } = callbackBasedIterator<number>();
    
    setTimeout(() => {
        send(1);
        send(2);
        done();
    }, 10);
    
    const results = [];
    for await (const item of it) {
        results.push(item);
    }
    
    expect(results).toEqual([1, 2]);
});

it('can be called multiple times with done', () => {
    const { done } = callbackBasedIterator<number>();
    
    done();
    done(); // Should not throw
});

it('handles different data types', async () => {
    const { send, done, it } = callbackBasedIterator<any>();
    
    send('string');
    send(42);
    send({ obj: 'value' });
    send([1, 2, 3]);
    done();
    
    const results = [];
    for await (const item of it) {
        results.push(item);
    }
    
    expect(results).toEqual(['string', 42, { obj: 'value' }, [1, 2, 3]]);
});

it('iterator stops when done is called', async () => {
    const { send, done, it } = callbackBasedIterator<number>();
    
    const results = [];
    const iterationPromise = (async () => {
        for await (const item of it) {
            results.push(item);
        }
    })();
    
    send(1);
    await new Promise(resolve => setTimeout(resolve, 10));
    
    send(2);
    done();
    
    await iterationPromise;
    
    expect(results).toEqual([1, 2]);
});