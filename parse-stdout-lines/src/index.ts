import { Stream } from "stream";
/*
 * unixPipeToLines
 *
 * Returns a callback that takes a Buffer stream (from stdout/stderr),
 * and calls the onCompleteLine callback for every completed line we receive.
 *
 * Useful when listening to data coming from a child process. The usage
 * looks like:
 *
 * process.stdout.on('data', unixPipeToLines(line => { ... }));
 *
 * When the stream is closed, the onCompleteLine callback will be called with 'null'.
 *
 */
export function unixPipeToLines(stream: Stream, onCompleteLine: (s: string | null) => void) {
    // currentLine contains the string for an unfinished line (when we haven't
    // received the newline yet)
    let currentLine: string | null = null;
    stream.on('data', (data: Buffer) => {
        const dataStr = data.toString('utf-8');
        const endsWithNewline = dataStr[dataStr.length - 1] == '\n';
        let lines = dataStr.split('\n').filter((s) => s !== '');
        let leftover: string | null = null;
        if (!endsWithNewline) {
            // Save the last line as leftover for later.
            leftover = lines[lines.length - 1];
            lines = lines.slice(0, lines.length - 1);
        }
        for (let line of lines) {
            if (currentLine) {
                line = currentLine + line;
                currentLine = null;
            }
            onCompleteLine(line);
        }
        if (endsWithNewline && currentLine) {
            // Edge case that can happen if the incoming data is only "\n".
            onCompleteLine(currentLine);
            currentLine = null;
        }
        if (leftover)
            currentLine = (currentLine || '') + leftover;
    });
    stream.on('close', () => {
        if (currentLine) {
            onCompleteLine(currentLine);
        }
        onCompleteLine(null);
    });
}
