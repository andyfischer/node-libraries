export default function unescape(s: string) {
    const out = [];
    let sliceStart = 0;
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '\\' && i + 1 < s.length) {
            // Add the slice before the backslash
            out.push(s.slice(sliceStart, i));
            // Handle the escaped character
            const nextChar = s[i + 1];
            switch (nextChar) {
                case 'n':
                    out.push('\n');
                    break;
                case 't':
                    out.push('\t');
                    break;
                case 'r':
                    out.push('\r');
                    break;
                case '\\':
                    out.push('\\');
                    break;
                case '"':
                    out.push('"');
                    break;
                case "'":
                    out.push("'");
                    break;
                case '0':
                    out.push('\0');
                    break;
                case 'b':
                    out.push('\b');
                    break;
                case 'f':
                    out.push('\f');
                    break;
                case 'v':
                    out.push('\v');
                    break;
                default:
                    // If it's not a recognized escape sequence, keep the backslash and character
                    out.push('\\' + nextChar);
                    break;
            }
            // Skip the escaped character
            i += 1;
            sliceStart = i + 1;
        }
    }
    out.push(s.slice(sliceStart));
    return out.join('');
}
