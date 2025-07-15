import { it, expect } from 'vitest'
import { StreamProtocolValidator, wrapStreamInValidator } from '../StreamProtocolValidator'
import { Stream } from '../Stream'
import { c_item, c_done, c_fail, c_log_info } from '../EventType'

it('validates known event types', () => {
    const validator1 = new StreamProtocolValidator('test1');
    const validator2 = new StreamProtocolValidator('test2');
    const validator3 = new StreamProtocolValidator('test3');
    const validator4 = new StreamProtocolValidator('test4');
    
    expect(() => validator1.check({ t: c_item, item: 'test' })).not.toThrow();
    expect(() => validator2.check({ t: c_done })).not.toThrow();
    expect(() => validator3.check({ t: c_fail, error: { errorMessage: 'error' } })).not.toThrow();
    expect(() => validator4.check({ t: c_log_info, message: 'info' })).not.toThrow();
});

it('rejects unknown event types', () => {
    const validator = new StreamProtocolValidator('test');
    
    expect(() => validator.check({ t: 'unknown_type' } as any)).toThrow(
        'Stream validation failed for (test), unknown event type'
    );
});

it('prevents events after done', () => {
    const validator = new StreamProtocolValidator('test');
    
    validator.check({ t: c_done });
    
    expect(() => validator.check({ t: c_item, item: 'test' })).toThrow(
        'Stream validation failed for (test), got message after the stream is closed'
    );
});

it('prevents events after fail', () => {
    const validator = new StreamProtocolValidator('test');
    
    validator.check({ t: c_fail, error: { errorMessage: 'error' } });
    
    expect(() => validator.check({ t: c_item, item: 'test' })).toThrow(
        'Stream validation failed for (test), got message after the stream is closed'
    );
});

it('tracks state correctly', () => {
    const validator = new StreamProtocolValidator('test');
    
    expect(validator.hasSentDone).toBe(false);
    expect(validator.hasSentFail).toBe(false);
    expect(validator.hasSeenFirstItem).toBe(false);
    
    validator.check({ t: c_item, item: 'test' });
    expect(validator.hasSeenFirstItem).toBe(true);
    
    validator.check({ t: c_done });
    expect(validator.hasSentDone).toBe(true);
});

it('wrapStreamInValidator creates validating stream wrapper', () => {
    const target = new Stream();
    const source = wrapStreamInValidator('test wrapper', target);
    
    source.item('test');
    source.done();
    
    expect(target.takeEventsSync()).toEqual([
        { t: c_item, item: 'test' },
        { t: c_done }
    ]);
});

it('wrapStreamInValidator validates events', () => {
    const target = new Stream();
    const source = wrapStreamInValidator('test wrapper', target);
    
    source.item('test');
    source.done();
    
    expect(() => source.item('after done')).toThrow();
});

it('allows multiple items before closing', () => {
    const validator = new StreamProtocolValidator('test');
    
    validator.check({ t: c_item, item: 'first' });
    validator.check({ t: c_item, item: 'second' });
    validator.check({ t: c_item, item: 'third' });
    validator.check({ t: c_done });
    
    expect(validator.hasSentDone).toBe(true);
    expect(validator.hasSeenFirstItem).toBe(true);
});