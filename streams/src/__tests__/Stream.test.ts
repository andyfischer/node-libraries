import { it, expect, vi } from 'vitest'
import { Stream, ProtocolError, UsageError } from '../Stream'
import { c_item, c_done, c_fail, c_log_info, c_log_warn, c_log_error, c_hint, c_hint_list, c_hint_single_item } from '../EventType'
import { BackpressureStop } from '../BackpressureStop'

it('collectEventsSync works correctly on a successfully closed stream', () => {
    const stream = new Stream();
    stream.item(1);
    stream.item(2);
    stream.done();
    const events = stream.takeEventsSync();
    expect(events).toEqual([
        { t: c_item, item: 1 },
        { t: c_item, item: 2 },
        { t: c_done },
    ]);
});

it('collectEventsSync works correctly on an errored stream', () => {
    const stream = new Stream();
    stream.item(1);
    stream.fail({ errorMessage: 'Oops!' });
    const events = stream.takeEventsSync();
    expect(events).toEqual([
        { t: c_item, item: 1 },
        { t: c_fail, error: { errorMessage: 'Oops!'} },
    ]);
});

it('constructor accepts name parameter', () => {
    const stream = new Stream({ name: 'test-stream' });
    expect(stream.upstreamMetadata.name).toBe('test-stream');
});

it('isStream returns true', () => {
    const stream = new Stream();
    expect(stream.isStream()).toBe(true);
});

it('isClosed returns true when closed by upstream or downstream', () => {
    const stream = new Stream();
    expect(stream.isClosed()).toBe(false);
    
    stream.done();
    expect(stream.isClosed()).toBe(true);
    
    const stream2 = new Stream();
    stream2.stopListening();
    expect(stream2.isClosed()).toBe(true);
});

it('hasDownstream returns true when receiver is set', () => {
    const stream = new Stream();
    expect(stream.hasDownstream()).toBe(false);
    
    stream.pipe(() => {});
    expect(stream.hasDownstream()).toBe(true);
});

it('fail method handles Error instances', () => {
    const stream = new Stream();
    const error = new Error('Test error');
    
    stream.fail(error);
    
    const events = stream.takeEventsSync();
    expect(events[0].t).toBe(c_fail);
    expect(events[0].error.errorMessage).toBe('Test error');
});

it('log methods create appropriate events', () => {
    const stream = new Stream();
    
    stream.info('info message', { detail: 'value' });
    stream.warn('warn message');
    stream.logError({ errorMessage: 'error message' });
    
    const events = stream.takeBacklog();
    expect(events[0].t).toBe(c_log_info);
    expect(events[0].message).toBe('info message');
    expect(events[1].t).toBe(c_log_warn);
    expect(events[1].message).toBe('warn message');
    expect(events[2].t).toBe(c_log_error);
    expect(events[2].error.errorMessage).toBe('error message');
});

it('hint methods create hint events', () => {
    const stream = new Stream();
    
    stream.hintList();
    stream.hintSingleItem();
    
    const events = stream.takeBacklog();
    expect(events[0].t).toBe(c_hint);
    expect(events[0].result).toBe(c_hint_list);
    expect(events[1].t).toBe(c_hint);
    expect(events[1].result).toBe(c_hint_single_item);
});

it('closeWithError does nothing if already closed', () => {
    const stream = new Stream();
    stream.done();
    
    stream.closeWithError({ errorMessage: 'error' });
    
    const events = stream.takeEventsSync();
    expect(events).toEqual([{ t: c_done }]);
});

it('pipe throws if stream already has receiver', () => {
    const stream = new Stream();
    stream.pipe(() => {});
    
    expect(() => stream.pipe(() => {})).toThrow(UsageError);
});

it('pipe throws if receiver is invalid', () => {
    const stream = new Stream();
    
    expect(() => stream.pipe({} as any)).toThrow(UsageError);
});

it('pipe sends backlog when receiver is set', () => {
    const stream = new Stream();
    stream.item(1);
    stream.item(2);
    
    const events = [];
    stream.pipe(event => events.push(event));
    
    expect(events).toEqual([
        { t: c_item, item: 1 },
        { t: c_item, item: 2 }
    ]);
});

it('takeItemsSync returns items and throws on error', () => {
    const stream = new Stream();
    stream.item(1);
    stream.item(2);
    stream.done();
    
    expect(stream.takeItemsSync()).toEqual([1, 2]);
    
    const errorStream = new Stream();
    errorStream.fail({ errorMessage: 'error' });
    
    expect(() => errorStream.takeItemsSync()).toThrow();
});

it('takeErrorSync returns error details', () => {
    const stream = new Stream();
    const error = { errorMessage: 'test error' };
    stream.fail(error);
    
    expect(stream.takeErrorSync()).toBe(error);
    
    const successStream = new Stream();
    successStream.done();
    
    expect(() => successStream.takeErrorSync()).toThrow(UsageError);
});

it('takeItemSync returns single item', () => {
    const stream = new Stream();
    stream.item('test');
    stream.done();
    
    expect(stream.takeItemSync()).toBe('test');
    
    const emptyStream = new Stream();
    emptyStream.done();
    
    expect(() => emptyStream.takeItemSync()).toThrow(UsageError);
});

it('promiseEvents resolves with events', async () => {
    const stream = new Stream();
    
    setTimeout(() => {
        stream.item(1);
        stream.done();
    }, 10);
    
    const events = await stream.promiseEvents();
    expect(events).toEqual([
        { t: c_item, item: 1 },
        { t: c_done }
    ]);
});

it('promiseItems resolves with items', async () => {
    const stream = new Stream();
    
    setTimeout(() => {
        stream.item(1);
        stream.item(2);
        stream.done();
    }, 10);
    
    const items = await stream.promiseItems();
    expect(items).toEqual([1, 2]);
});

it('promiseItems rejects on error', async () => {
    const stream = new Stream();
    
    setTimeout(() => {
        stream.fail({ errorMessage: 'error' });
    }, 10);
    
    await expect(stream.promiseItems()).rejects.toThrow();
});

it('promiseItem resolves with first item', async () => {
    const stream = new Stream();
    
    const promise = stream.promiseItem();
    
    stream.item('first');
    
    const item = await promise;
    expect(item).toBe('first');
});

it('wait resolves when stream is done', async () => {
    const stream = new Stream();
    
    setTimeout(() => {
        stream.done();
    }, 10);
    
    await stream.wait();
});

it('wait rejects on error', async () => {
    const stream = new Stream();
    
    setTimeout(() => {
        stream.fail({ errorMessage: 'error' });
    }, 10);
    
    await expect(stream.wait()).rejects.toThrow();
});

it('synchronous iterator works', () => {
    const stream = new Stream();
    stream.item(1);
    stream.item(2);
    stream.done();
    
    const items = [...stream];
    expect(items).toEqual([1, 2]);
});

it('async iterator works', async () => {
    const stream = new Stream();
    
    setTimeout(() => {
        stream.item(1);
        stream.item(2);
        stream.done();
    }, 10);
    
    const items = [];
    for await (const item of stream) {
        items.push(item);
    }
    
    expect(items).toEqual([1, 2]);
});

it('takeBacklogItems returns items from backlog', () => {
    const stream = new Stream();
    stream.item(1);
    stream.item(2);
    
    expect(stream.takeBacklogItems()).toEqual([1, 2]);
});

it('spyEvents calls callback for each event', () => {
    const stream = new Stream();
    const spy = vi.fn();
    
    const output = stream.spyEvents(spy);
    
    stream.item('test');
    stream.done();
    
    expect(spy).toHaveBeenCalledTimes(2);
    expect(output.takeEventsSync()).toEqual([
        { t: c_item, item: 'test' },
        { t: c_done }
    ]);
});

it('spyItems calls callback for item events only', () => {
    const stream = new Stream();
    const spy = vi.fn();
    
    const output = stream.spyItems(spy);
    
    stream.item('test');
    stream.done();
    
    expect(spy).toHaveBeenCalledWith('test');
    expect(spy).toHaveBeenCalledTimes(1);
});

it('map transforms items', () => {
    const stream = new Stream();
    
    const mapped = stream.map(x => x * 2);
    
    stream.item(5);
    stream.item(10);
    stream.done();
    
    expect(mapped.takeItemsSync()).toEqual([10, 20]);
});

it('map filters falsy results', () => {
    const stream = new Stream();
    
    const mapped = stream.map(x => x > 5 ? x : null);
    
    stream.item(3);
    stream.item(7);
    stream.item(2);
    stream.item(8);
    stream.done();
    
    expect(mapped.takeItemsSync()).toEqual([7, 8]);
});

it('mapcat expands arrays', () => {
    const stream = new Stream();
    
    const mapped = stream.mapcat(x => [x, x * 2]);
    
    stream.item(3);
    stream.item(4);
    stream.done();
    
    expect(mapped.takeItemsSync()).toEqual([3, 6, 4, 8]);
});

it('onItem calls callback for items', () => {
    const stream = new Stream();
    const callback = vi.fn();
    
    stream.onItem(callback);
    
    stream.item('test');
    stream.done();
    
    expect(callback).toHaveBeenCalledWith('test');
});

it('forEach processes all items', async () => {
    const stream = new Stream();
    const callback = vi.fn();
    
    setTimeout(() => {
        stream.item(1);
        stream.item(2);
        stream.done();
    }, 10);
    
    await stream.forEach(callback);
    
    expect(callback).toHaveBeenCalledWith(1);
    expect(callback).toHaveBeenCalledWith(2);
});

it('stopListening closes stream from downstream', () => {
    const stream = new Stream();
    stream.pipe(() => {});
    
    stream.stopListening();
    
    expect(stream.closedByDownstream).toBe(true);
    expect(stream.receiver).toBe(null);
});

it('getDebugLabel formats properly', () => {
    const stream = new Stream({ name: 'test' });
    const label = stream.getDebugLabel();
    
    expect(label).toContain('Stream');
    expect(label).toContain('test');
});

it('static constructors work', () => {
    const emptyStream = Stream.newEmptyStream();
    expect(emptyStream.takeEventsSync()).toEqual([{ t: c_done }]);
    
    const listStream = Stream.fromList([1, 2, 3]);
    expect(listStream.takeItemsSync()).toEqual([1, 2, 3]);
    
    const eventStream = Stream.fromEvents([
        { t: c_item, item: 'test' },
        { t: c_done }
    ]);
    expect(eventStream.takeEventsSync()).toEqual([
        { t: c_item, item: 'test' },
        { t: c_done }
    ]);
});

it('handles BackpressureStop in receiver', () => {
    const stream = new Stream();
    
    stream.pipe(() => {
        throw new BackpressureStop();
    });
    
    stream.item('test');
    
    expect(stream.closedByDownstream).toBe(true);
});

it('throws ProtocolError on events after close', () => {
    const stream = new Stream();
    stream.done();
    
    expect(() => stream.item('test')).toThrow(ProtocolError);
});

it('listen calls item callback for item events', () => {
    const stream = new Stream();
    const itemCallback = vi.fn();
    
    stream.listen({ item: itemCallback });
    
    stream.item('test1');
    stream.item('test2');
    stream.done();
    
    expect(itemCallback).toHaveBeenCalledWith('test1');
    expect(itemCallback).toHaveBeenCalledWith('test2');
    expect(itemCallback).toHaveBeenCalledTimes(2);
});

it('listen calls done callback for done event', () => {
    const stream = new Stream();
    const doneCallback = vi.fn();
    
    stream.listen({ done: doneCallback });
    
    stream.item('test');
    stream.done();
    
    expect(doneCallback).toHaveBeenCalledTimes(1);
    expect(doneCallback).toHaveBeenCalledWith();
});

it('listen calls fail callback for fail event', () => {
    const stream = new Stream();
    const failCallback = vi.fn();
    const error = { errorMessage: 'test error' };
    
    stream.listen({ fail: failCallback });
    
    stream.item('test');
    stream.fail(error);
    
    expect(failCallback).toHaveBeenCalledWith(error);
    expect(failCallback).toHaveBeenCalledTimes(1);
});

it('listen works with all callback types', () => {
    const stream = new Stream();
    const itemCallback = vi.fn();
    const doneCallback = vi.fn();
    const failCallback = vi.fn();
    
    stream.listen({
        item: itemCallback,
        done: doneCallback,
        fail: failCallback
    });
    
    stream.item('test1');
    stream.item('test2');
    stream.done();
    
    expect(itemCallback).toHaveBeenCalledWith('test1');
    expect(itemCallback).toHaveBeenCalledWith('test2');
    expect(doneCallback).toHaveBeenCalledTimes(1);
    expect(failCallback).not.toHaveBeenCalled();
});

it('listen works with partial callback objects', () => {
    const stream = new Stream();
    const itemCallback = vi.fn();
    
    stream.listen({ item: itemCallback });
    
    stream.item('test');
    stream.done();
    
    expect(itemCallback).toHaveBeenCalledWith('test');
});

it('listen handles empty callback object', () => {
    const stream = new Stream();
    
    expect(() => {
        stream.listen({});
        stream.item('test');
        stream.done();
    }).not.toThrow();
});

it('listen ignores non-item/done/fail events', () => {
    const stream = new Stream();
    const itemCallback = vi.fn();
    const doneCallback = vi.fn();
    const failCallback = vi.fn();
    
    stream.listen({
        item: itemCallback,
        done: doneCallback,
        fail: failCallback
    });
    
    stream.info('info message');
    stream.warn('warn message');
    stream.item('test');
    stream.done();
    
    expect(itemCallback).toHaveBeenCalledWith('test');
    expect(itemCallback).toHaveBeenCalledTimes(1);
    expect(doneCallback).toHaveBeenCalledTimes(1);
    expect(failCallback).not.toHaveBeenCalled();
});

it('listen works with stream that has backlog', () => {
    const stream = new Stream();
    const itemCallback = vi.fn();
    const doneCallback = vi.fn();
    
    stream.item('backlog1');
    stream.item('backlog2');
    stream.done();
    
    stream.listen({
        item: itemCallback,
        done: doneCallback
    });
    
    expect(itemCallback).toHaveBeenCalledWith('backlog1');
    expect(itemCallback).toHaveBeenCalledWith('backlog2');
    expect(doneCallback).toHaveBeenCalledTimes(1);
});

it('listen with async callbacks', async () => {
    const stream = new Stream();
    const items: string[] = [];
    let completed = false;
    
    stream.listen({
        item: (item: string) => items.push(item),
        done: () => { completed = true; }
    });
    
    setTimeout(() => {
        stream.item('async1');
        stream.item('async2');
        stream.done();
    }, 10);
    
    await new Promise(resolve => {
        const check = () => {
            if (completed) {
                resolve(null);
            } else {
                setTimeout(check, 5);
            }
        };
        check();
    });
    
    expect(items).toEqual(['async1', 'async2']);
    expect(completed).toBe(true);
});

