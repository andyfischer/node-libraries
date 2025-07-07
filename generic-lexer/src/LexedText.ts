import { Token } from './Token';
import unescape from './unescape';
import { t_quoted_string } from './tokens';
export class LexedText {
    tokens: Token[];
    originalStr: string;
    constructor(originalStr: string) {
        this.originalStr = originalStr;
    }
    getTokenText(token: Token) {
        return this.originalStr.slice(token.textStart, token.textEnd);
    }
    getUnquotedText(token: Token) {
        if (token.match === t_quoted_string) {
            const str = this.originalStr.slice(token.textStart + 1, token.textEnd - 1);
            return unescape(str);
        }
        return this.getTokenText(token);
    }
    tokenCharIndex(tokenIndex: number) {
        if (tokenIndex >= this.tokens.length)
            return this.originalStr.length;
        return this.tokens[tokenIndex].textStart;
    }
    startCharOfToken(tokenIndex: number) {
        if (tokenIndex >= this.tokens.length)
            return this.originalStr.length;
        return this.tokens[tokenIndex].textStart;
    }
    endCharOfToken(tokenIndex: number) {
        if (tokenIndex >= this.tokens.length)
            return this.originalStr.length;
        return this.tokens[tokenIndex].textEnd;
    }
    getLastTokenIndex() {
        return this.tokens.length;
    }
    getTextRange(startToken: number, endToken: number) {
        if (startToken < 0 || startToken >= this.tokens.length) {
            throw new Error(`Invalid startToken index: ${startToken}. Must be between 0 and ${this.tokens.length - 1}.`);
        }
        if (endToken < 1 || endToken > this.tokens.length) {
            throw new Error(`Invalid endToken index: ${endToken}. Must be between 1 and ${this.tokens.length}.`);
        }
        if (startToken >= endToken) {
            throw new Error(`Invalid range: startToken (${startToken}) must be less than endToken (${endToken}).`);
        }
        const textStart = this.tokens[startToken].textStart;
        const textEnd = this.tokens[endToken - 1].textEnd;
        return this.originalStr.slice(textStart, textEnd);
    }
    toDebugDump() {
        let out = [];
        for (const token of this.tokens) {
            let text = this.getTokenText(token);
            text = text.replace('\n', '\\n');
            out.push(`${token.match.name}: textStart=${token.textStart} textEnd=${token.textEnd} text=${text}`);
        }
        return out.join('\n');
    }
}
