import { getDatabase } from './database';

export interface GarbageCollectionOptions {
  deleteLogsOlderThanDays?: number;
  deleteStackTracesOlderThanDays?: number;
}

export function deleteOldLogs(days: number): number {
  const db = getDatabase();
  
  // Delete stack traces for logs that will be deleted
  db.run(
    `DELETE FROM log_event_stacks 
     WHERE log_event_id IN (
       SELECT id FROM log_events 
       WHERE created_at < datetime('now', '-' || ? || ' days')
     )`,
    [days]
  );
  
  // Delete old log events
  const result = db.run(
    `DELETE FROM log_events 
     WHERE created_at < datetime('now', '-' || ? || ' days')`,
    [days]
  );
  
  return result.changes;
}

export function deleteOldStackTraces(days: number): number {
  const db = getDatabase();
  
  // Delete stack traces older than specified days
  const result = db.run(
    `DELETE FROM log_event_stacks 
     WHERE created_at < datetime('now', '-' || ? || ' days')`,
    [days]
  );
  
  return result.changes;
}

export function performGarbageCollection(options: GarbageCollectionOptions): {
  deletedLogs: number;
  deletedStackTraces: number;
} {
  let deletedLogs = 0;
  let deletedStackTraces = 0;
  
  if (options.deleteLogsOlderThanDays) {
    deletedLogs = deleteOldLogs(options.deleteLogsOlderThanDays);
  }
  
  if (options.deleteStackTracesOlderThanDays) {
    deletedStackTraces = deleteOldStackTraces(options.deleteStackTracesOlderThanDays);
  }
  
  return { deletedLogs, deletedStackTraces };
}

export function cleanupOrphanedSessions(): {
  deletedRequestSessions: number;
  deletedTestSessions: number;
} {
  const db = getDatabase();
  
  // Delete request sessions that have no associated log events
  const requestResult = db.run(
    `DELETE FROM request_sessions 
     WHERE id NOT IN (
       SELECT DISTINCT request_session_id 
       FROM log_events 
       WHERE request_session_id IS NOT NULL
     )`
  );
  
  // Delete test sessions that have no associated log events
  const testResult = db.run(
    `DELETE FROM test_sessions 
     WHERE id NOT IN (
       SELECT DISTINCT test_session_id 
       FROM log_events 
       WHERE test_session_id IS NOT NULL
     )`
  );
  
  return {
    deletedRequestSessions: requestResult.changes,
    deletedTestSessions: testResult.changes
  };
}