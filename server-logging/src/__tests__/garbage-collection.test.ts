import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import { 
  initializeDatabase, 
  getDatabase,
  resetDatabase,
  logInfo, 
  performGarbageCollection,
  deleteOldLogs,
  deleteOldStackTraces,
  cleanupOrphanedSessions,
  createRequestSession,
  createTestSession
} from '../index';
import { initializeLogging } from '../initialize';

const TEST_DB = './test-gc.sqlite';

describe('Garbage Collection', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
    initializeLogging({
      databaseFilename: TEST_DB,
      enableConsoleLogging: false,
    });
  });

  it('should delete old logs', () => {
    const db = getDatabase();
    db.run('DELETE FROM log_events', []);
    
    // Insert old log (30 days ago)
    db.run(
      `INSERT INTO log_events (level, message, created_at) 
       VALUES (?, ?, datetime('now', '-30 days'))`,
      ['info', 'Old message']
    );
    
    // Insert recent log
    logInfo('Recent message');
    
    // Delete logs older than 7 days
    const deleted = deleteOldLogs(7);
    
    expect(deleted).toBe(1);
    
    const remainingLogs = db.list('SELECT * FROM log_events', []);
    expect(remainingLogs).toHaveLength(1);
    expect(remainingLogs[0].message).toBe('Recent message');
  });

  it('should delete old stack traces', () => {
    const db = getDatabase();
    db.run('DELETE FROM log_events', []);
    db.run('DELETE FROM log_event_stacks', []);
    
    // Insert log with stack trace
    const result = db.run(
      `INSERT INTO log_events (level, message) VALUES (?, ?)`,
      ['error', 'Test error']
    );
    const logId = result.lastInsertRowid;
    
    // Insert old stack trace
    db.run(
      `INSERT INTO log_event_stacks (log_event_id, stack_trace_text, created_at) 
       VALUES (?, ?, datetime('now', '-30 days'))`,
      [logId, 'Old stack trace']
    );
    
    // Delete stack traces older than 7 days
    const deleted = deleteOldStackTraces(7);
    
    expect(deleted).toBe(1);
    
    const remainingStacks = db.list('SELECT * FROM log_event_stacks', []);
    expect(remainingStacks).toHaveLength(0);
  });

  it('should perform comprehensive garbage collection', () => {
    const db = getDatabase();
    db.run('DELETE FROM log_events', []);
    
    // Insert old and new logs
    db.run(
      `INSERT INTO log_events (level, message, created_at) 
       VALUES (?, ?, datetime('now', '-30 days'))`,
      ['info', 'Old message']
    );
    logInfo('Recent message');
    
    // Perform garbage collection
    const result = performGarbageCollection({
      deleteLogsOlderThanDays: 7,
      deleteStackTracesOlderThanDays: 3
    });
    
    expect(result.deletedLogs).toBe(1);
    
    const remainingLogs = db.list('SELECT * FROM log_events', []);
    expect(remainingLogs).toHaveLength(1);
  });

  it('should cleanup orphaned sessions', () => {
    const db = getDatabase();
    db.run('DELETE FROM log_events', []);
    db.run('DELETE FROM request_sessions', []);
    db.run('DELETE FROM test_sessions', []);
    
    // Create sessions without associated logs
    const orphanedRequestId = createRequestSession();
    const orphanedTestId = createTestSession('test-guid-orphaned');
    
    // Create session with associated log
    const usedRequestId = createRequestSession();
    db.run(
      `INSERT INTO log_events (level, message, request_session_id) 
       VALUES (?, ?, ?)`,
      ['info', 'Message with session', usedRequestId]
    );
    
    // Cleanup orphaned sessions
    const result = cleanupOrphanedSessions();
    
    expect(result.deletedRequestSessions).toBe(1);
    expect(result.deletedTestSessions).toBe(1);
    
    // Verify used session still exists
    const remainingSessions = db.list('SELECT * FROM request_sessions', []);
    expect(remainingSessions).toHaveLength(1);
    expect(remainingSessions[0].id).toBe(usedRequestId);
  });
});