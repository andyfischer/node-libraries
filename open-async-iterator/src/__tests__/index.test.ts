import { describe, it, expect } from 'vitest'
import { openAsyncIterator } from '../index'

describe('openAsyncIterator', () => {
  it('should yield items that are sent', async () => {
    const { send, done, iterator } = openAsyncIterator<number>()
    
    const results: number[] = []
    
    const consumePromise = (async () => {
      for await (const item of iterator) {
        results.push(item)
      }
    })()
    
    send(1)
    send(2)
    send(3)
    done()
    
    await consumePromise
    
    expect(results).toEqual([1, 2, 3])
  })
  
  it('should handle multiple items sent before iteration starts', async () => {
    const { send, done, iterator } = openAsyncIterator<string>()
    
    send('hello')
    send('world')
    done()
    
    const results: string[] = []
    for await (const item of iterator) {
      results.push(item)
    }
    
    expect(results).toEqual(['hello', 'world'])
  })
  
  it('should handle items sent during iteration', async () => {
    const { send, done, iterator } = openAsyncIterator<number>()
    
    const results: number[] = []
    
    const consumePromise = (async () => {
      for await (const item of iterator) {
        results.push(item)
      }
    })()
    
    await new Promise(resolve => setTimeout(resolve, 10))
    send(1)
    
    await new Promise(resolve => setTimeout(resolve, 10))
    send(2)
    
    await new Promise(resolve => setTimeout(resolve, 10))
    done()
    
    await consumePromise
    
    expect(results).toEqual([1, 2])
  })
  
  it('should throw error when send is called after done', async () => {
    const { send, done } = openAsyncIterator<number>()
    
    done()
    
    expect(() => send(1)).toThrow('usage error: called send() after done()')
  })
  
  it('should handle empty iterator (done called immediately)', async () => {
    const { done, iterator } = openAsyncIterator<number>()
    
    done()
    
    const results: number[] = []
    for await (const item of iterator) {
      results.push(item)
    }
    
    expect(results).toEqual([])
  })
  
  it('should handle batched items correctly', async () => {
    const { send, done, iterator } = openAsyncIterator<number>()
    
    const results: number[] = []
    
    const consumePromise = (async () => {
      for await (const item of iterator) {
        results.push(item)
      }
    })()
    
    send(1)
    send(2)
    send(3)
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    send(4)
    send(5)
    done()
    
    await consumePromise
    
    expect(results).toEqual([1, 2, 3, 4, 5])
  })
  
  it('should work with different data types', async () => {
    interface TestObject {
      id: number
      name: string
    }
    
    const { send, done, iterator } = openAsyncIterator<TestObject>()
    
    const obj1 = { id: 1, name: 'first' }
    const obj2 = { id: 2, name: 'second' }
    
    send(obj1)
    send(obj2)
    done()
    
    const results: TestObject[] = []
    for await (const item of iterator) {
      results.push(item)
    }
    
    expect(results).toEqual([obj1, obj2])
  })
  
  it('should work with async iterator protocol', async () => {
    const { send, done, iterator } = openAsyncIterator<number>()
    
    const asyncIter = iterator[Symbol.asyncIterator]()
    
    send(1)
    send(2)
    done()
    
    const result1 = await asyncIter.next()
    expect(result1.value).toBe(1)
    expect(result1.done).toBe(false)
    
    const result2 = await asyncIter.next()
    expect(result2.value).toBe(2)
    expect(result2.done).toBe(false)
    
    const result3 = await asyncIter.next()
    expect(result3.done).toBe(true)
  })
  
  it('should handle rapid send calls', async () => {
    const { send, done, iterator } = openAsyncIterator<number>()
    
    const results: number[] = []
    
    const consumePromise = (async () => {
      for await (const item of iterator) {
        results.push(item)
      }
    })()
    
    for (let i = 0; i < 100; i++) {
      send(i)
    }
    done()
    
    await consumePromise
    
    expect(results).toEqual(Array.from({ length: 100 }, (_, i) => i))
  })
  
  it('should properly reset unpauseIterator after each pause', async () => {
    const { send, done, iterator } = openAsyncIterator<number>()
    
    const results: number[] = []
    
    const consumePromise = (async () => {
      for await (const item of iterator) {
        results.push(item)
        if (results.length === 2) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }
    })()
    
    send(1)
    await new Promise(resolve => setTimeout(resolve, 10))
    
    send(2)
    await new Promise(resolve => setTimeout(resolve, 20))
    
    send(3)
    done()
    
    await consumePromise
    
    expect(results).toEqual([1, 2, 3])
  })
})