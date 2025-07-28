// Database initialization
export { getDatabase} from './database';

export { initializeLogging } from './initialize';

// Logging functions
export { logInfo, logWarn, logError, LogLevel } from './logging';

// Stream integration
export { createLogStream, } from './log-stream';

// Session management
export {
  SessionContext,
  getCurrentContext,
  runWithContext,
  withRequestSession,
  createRequestSession,
  createTestSession,
  setTestSession,
  setUserId,
  getNextSessionIncId,
  generateGuid
} from './sessions';

// Garbage collection
export {
  GarbageCollectionOptions,
  performGarbageCollection,
  deleteOldLogs,
  deleteOldStackTraces,
  cleanupOrphanedSessions
} from './garbage-collection';

// Actions
export {
  getLogsForTestSession,
  getLogsForRequestSession,
  getErrorLogs,
  getStackTraceForLog
} from './actions';

// Schemas
export {
  PaginationParams,
  LogEntry,
  LogEntryWithStackTrace,
  PaginatedResponse,
  GetLogsForTestSessionRequest,
  GetLogsForRequestSessionRequest,
  GetErrorLogsRequest,
  GetStackTraceForLogRequest,
  GetStackTraceForLogResponse,
  GetLogsForTestSessionResponse,
  GetLogsForRequestSessionResponse,
  GetErrorLogsResponse,
  // Zod schemas
  zPaginationParams,
  zLogEntry,
  zLogEntryWithStackTrace,
  zPaginatedResponse,
  zGetLogsForTestSessionRequest,
  zGetLogsForRequestSessionRequest,
  zGetErrorLogsRequest,
  zGetStackTraceForLogRequest,
  zGetStackTraceForLogResponse,
  zGetLogsForTestSessionResponse,
  zGetLogsForRequestSessionResponse,
  zGetErrorLogsResponse
} from './schemas';

// Re-export types from sqlite-wrapper for convenience
export { SqliteDatabase } from '@andyfischer/sqlite-wrapper';