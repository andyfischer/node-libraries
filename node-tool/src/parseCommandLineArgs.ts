
import { Query, parseQuery } from '@andyfischer/query'

export function parseCommandLineArgs(args: string[]): Query {
    const str = args.join(' ');
    if (str === '')
        return new Query([]);

    const result = parseQuery(str);
    return result as Query;
}

