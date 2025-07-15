import { it, expect, vi } from 'vitest'
import { StreamDispatcher } from '../StreamDispatcher'
import { c_item, c_done, c_fail, c_log_info, c_log_warn } from '../EventType'
import { BackpressureStop } from '../BackpressureStop'

it('newListener creates a new stream and adds it to listeners', () => {
    const dispatcher = new StreamDispatcher();
    const stream = dispatcher.newListener();
    
    expect(dispatcher.listeners.length).toBe(1);
    expect(dispatcher.listeners[0][0]).toBe(stream);
});

it('newListener can include metadata', () => {
    const dispatcher = new StreamDispatcher();
    const metadata = { id: 'test' };
    const stream = dispatcher.newListener({ metadata });
    
    expect(dispatcher.listeners[0][1]).toBe(metadata);
});

it('addListener adds existing stream to listeners', () => {
    const dispatcher = new StreamDispatcher();
    const stream = dispatcher.newListener();
    const stream2 = dispatcher.newListener();
    
    expect(dispatcher.listeners.length).toBe(2);
});

it('item method sends item events to all listeners', () => {
    const dispatcher = new StreamDispatcher();
    const stream1 = dispatcher.newListener();
    const stream2 = dispatcher.newListener();
    
    dispatcher.item('test');
    dispatcher.close();
    
    expect(stream1.takeEventsSync()).toEqual([{ t: c_item, item: 'test' }, { t: c_done }]);
    expect(stream2.takeEventsSync()).toEqual([{ t: c_item, item: 'test' }, { t: c_done }]);
});

it('close method sends done event to all listeners', () => {
    const dispatcher = new StreamDispatcher();
    const stream1 = dispatcher.newListener();
    const stream2 = dispatcher.newListener();
    
    dispatcher.close();
    
    expect(stream1.takeEventsSync()).toEqual([{ t: c_done }]);
    expect(stream2.takeEventsSync()).toEqual([{ t: c_done }]);
    expect(dispatcher.closed).toBe(true);
});

it('prevents events after closing', () => {
    const dispatcher = new StreamDispatcher();
    dispatcher.close();
    
    expect(() => dispatcher.item('test')).toThrow(BackpressureStop);
});

it('removes closed listeners from the list', () => {
    const dispatcher = new StreamDispatcher();
    const stream1 = dispatcher.newListener();
    const stream2 = dispatcher.newListener();
    
    stream1.stopListening();
    dispatcher.item('test');
    dispatcher.close();
    
    expect(dispatcher.listeners.length).toBe(0);
    expect(stream2.takeEventsSync()).toEqual([{ t: c_item, item: 'test' }, { t: c_done }]);
});

it('handles BackpressureStop exceptions from listeners', () => {
    const dispatcher = new StreamDispatcher();
    const stream1 = dispatcher.newListener();
    const stream2 = dispatcher.newListener();
    
    stream1.pipe(() => {
        throw new BackpressureStop();
    });
    
    dispatcher.item('test');
    dispatcher.close();
    
    expect(dispatcher.listeners.length).toBe(0);
    expect(stream2.takeEventsSync()).toEqual([{ t: c_item, item: 'test' }, { t: c_done }]);
});

it('forEach method calls callback for each listener', () => {
    const dispatcher = new StreamDispatcher();
    const stream1 = dispatcher.newListener({ metadata: 'meta1' });
    const stream2 = dispatcher.newListener({ metadata: 'meta2' });
    
    const results = [];
    dispatcher.forEach((stream, metadata) => {
        results.push({ stream, metadata });
    });
    
    expect(results.length).toBe(2);
    expect(results[0].stream).toBe(stream1);
    expect(results[0].metadata).toBe('meta1');
    expect(results[1].stream).toBe(stream2);
    expect(results[1].metadata).toBe('meta2');
});

it('onItem creates listener with item callback', () => {
    const dispatcher = new StreamDispatcher();
    const callback = vi.fn();
    
    dispatcher.onItem(callback);
    dispatcher.item('test');
    
    expect(callback).toHaveBeenCalledWith('test');
});

it('info method sends log info events', () => {
    const dispatcher = new StreamDispatcher();
    const stream = dispatcher.newListener();
    
    dispatcher.info('test message', { detail: 'value' });
    dispatcher.close();
    
    const events = stream.takeEventsSync();
    expect(events[0].t).toBe(c_log_info);
    expect(events[0].message).toBe('test message');
    expect(events[0].details).toEqual({ detail: 'value' });
});

it('warn method sends log warn events', () => {
    const dispatcher = new StreamDispatcher();
    const stream = dispatcher.newListener();
    
    dispatcher.warn('warning message');
    dispatcher.close();
    
    const events = stream.takeEventsSync();
    expect(events[0].t).toBe(c_log_warn);
    expect(events[0].message).toBe('warning message');
});

it('clears all listeners on done/fail events', () => {
    const dispatcher = new StreamDispatcher();
    dispatcher.newListener();
    dispatcher.newListener();
    
    expect(dispatcher.listeners.length).toBe(2);
    
    dispatcher.close();
    
    expect(dispatcher.listeners.length).toBe(0);
    expect(dispatcher.closed).toBe(true);
});