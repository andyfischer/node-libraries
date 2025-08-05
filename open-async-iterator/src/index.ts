export function openAsyncIterator<T = any>() {

    let incoming: T[] = [];
    let isDone = false;
    let unpauseIterator: () => void = null;

    function send(msg: T) {
        if (isDone)
            throw new Error('usage error: called send() after done()');

        incoming.push(msg);

        if (unpauseIterator)
            unpauseIterator();
    }
    
    function done() {
        isDone = true;

        if (unpauseIterator)
            unpauseIterator();
    }
    
    const iterator = {
        [Symbol.asyncIterator]: async function* () {

            while (true) {
                while (incoming.length > 0) {
                    const received: T[] = incoming;
                    incoming = [];

                    for (const msg of received) {
                        yield msg;
                    }
                }

                if (isDone)
                    return;

                await new Promise<void>(r => { unpauseIterator = r });
                unpauseIterator = null;
            }
        }
    }

    return {
        send,
        done,
        iterator,
    }
}