
export class BackpressureStop extends Error {
    is_backpressure_stop = true

    constructor() {
        super("Can't put to stream (backpressure stop)");
    }
}

export function exceptionIsBackpressureStop(e: Error) {
    return e && e['is_backpressure_stop'];
}
