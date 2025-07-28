import { Stream, c_log_info, c_log_warn, c_log_error } from '@andyfischer/streams';
import { logInfo, logWarn, logError } from './logging';

export function createLogStream(prefix?: string): Stream {
  let prefixSection = prefix ? `[${prefix}] ` : '';
  const stream = new Stream();
  stream.pipe(evt => {
    switch (evt.t) {
      case c_log_info:
        logInfo(`${prefixSection}${evt.message}`, evt.details);
        break;

      case c_log_warn:
        logWarn(`${prefixSection}${evt.message}`, evt.details);
        break;

      case c_log_error: {
        let params: Record<string, any> = {};
        for (const related of evt.error.related) {
          params = {
            ...params,
            ...related,
        };

        if (evt.error.errorType) {
          params.errorType = evt.error.errorType;
        }

        logError(`${prefixSection}${evt.error.errorMessage}`,
          params,
          evt.error.stack,
        );
        break;
      }
      }
    }
  });
    
  return stream;
}
