import { it, expect } from 'vitest'
import { BackpressureStop, exceptionIsBackpressureStop } from '../BackpressureStop'

it('BackpressureStop is an Error instance', () => {
    const error = new BackpressureStop();
    
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Can't put to stream (backpressure stop)");
});

it('BackpressureStop has identifying property', () => {
    const error = new BackpressureStop();
    
    expect(error.is_backpressure_stop).toBe(true);
});

it('exceptionIsBackpressureStop identifies BackpressureStop errors', () => {
    const backpressureError = new BackpressureStop();
    const regularError = new Error('Regular error');
    
    expect(exceptionIsBackpressureStop(backpressureError)).toBe(true);
    expect(exceptionIsBackpressureStop(regularError)).toBeFalsy();
});

it('exceptionIsBackpressureStop handles objects with property', () => {
    const fakeBackpressureError = { is_backpressure_stop: true } as any;
    const objectWithoutProperty = { some_other_prop: true } as any;
    
    expect(exceptionIsBackpressureStop(fakeBackpressureError)).toBe(true);
    expect(exceptionIsBackpressureStop(objectWithoutProperty)).toBeFalsy();
});

it('exceptionIsBackpressureStop handles null and undefined', () => {
    expect(exceptionIsBackpressureStop(null as any)).toBeFalsy();
    expect(exceptionIsBackpressureStop(undefined as any)).toBeFalsy();
});