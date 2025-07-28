import { getDatabase } from './database';
import { getLoggingSettings } from './initialize';
import { getCurrentContext, getNextSessionIncId } from './sessions';

export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// Maximum message length (64KB should be plenty for log messages)
const MAX_MESSAGE_LENGTH = 65536;

function truncateMessage(message: string): string {
  // Handle null/undefined by converting to empty string
  if (message === null || message === undefined) {
    return '';
  }
  
  // Convert to string if not already (for safety)
  const msgStr = String(message);
  
  if (msgStr.length <= MAX_MESSAGE_LENGTH) {
    return msgStr;
  }
  
  const truncatedLength = MAX_MESSAGE_LENGTH - 50; // Leave room for truncation message
  return msgStr.substring(0, truncatedLength) + '\n... (truncated from ' + msgStr.length + ' to ' + MAX_MESSAGE_LENGTH + ' characters)';
}

function captureStackTrace(): string {
  const stack = new Error().stack;
  if (!stack) return '';
  
  // Remove the first few lines that are internal to this logging module
  const lines = stack.split('\n');
  // Remove "Error" line and lines from this file
  const filteredLines = lines.filter((line, index) => {
    if (index === 0) return false; // Skip "Error" line
    if (line.includes('logging.ts')) return false;
    if (line.includes('logging.js')) return false;
    return true;
  });
  
  return filteredLines.join('\n').trim();
}

function log(level: LogLevel, message: string, stackTrace?: string, params?: Record<string, any>): void {
  if (!getLoggingSettings()) {
    throw new Error('log() called before initializeLogging()');
  }

  const db = getDatabase();
  const context = getCurrentContext();
  const sessionIncId = getNextSessionIncId();
  
  // Truncate message if too long
  const truncatedMessage = truncateMessage(message);
  
  // Serialize params to JSON if provided
  const paramsJson = params ? JSON.stringify(params) : null;
  
  // Insert log event
  const result = db.run(
    `INSERT INTO log_events (user_id, request_session_id, test_session_id, session_inc_id, level, message, params_json) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      context?.userId || null,
      context?.requestSessionId || null,
      context?.testSessionId || null,
      sessionIncId || null,
      level,
      truncatedMessage,
      paramsJson
    ]
  );
  
  const logEventId = result.lastInsertRowid as number;
  
  // Capture and store stack trace
  stackTrace = stackTrace || captureStackTrace();

  if (stackTrace) {
    // Also truncate stack traces as they can be very long
    const truncatedStackTrace = truncateMessage(stackTrace);
    db.run(
      `INSERT INTO log_event_stacks (log_event_id, stack_trace_text) VALUES (?, ?)`,
      [logEventId, truncatedStackTrace]
    );
  }

  // If console logging is enabled, log to console
  if (getLoggingSettings()?.enableConsoleLogging) {
    let formattedMessage  = `${level}: ${message}`;
    if (params) {
      formattedMessage += ` ${JSON.stringify(params)}`;
    }
    console.log(formattedMessage);
  }
}

export function logInfo(message: string, params?: Record<string, any>): void {
  log(LogLevel.INFO, message, undefined, params);
}

export function logWarn(message: string, params?: Record<string, any>): void {
  log(LogLevel.WARN, message, undefined, params);
}

export function logError(message: string, params?: Record<string, any>, error?: Error): void {
  let stackTrace = error?.stack;
  log(LogLevel.ERROR, message, stackTrace, params);
}
