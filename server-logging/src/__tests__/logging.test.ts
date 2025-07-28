import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import * as fs from 'fs';
import { 
  getDatabase,
  logInfo, 
  logWarn, 
  logError,
  withRequestSession,
  setUserId,
  setTestSession,
  createTestSession
} from '../index';
import { initializeLogging } from '../initialize';

const TEST_DB = './test-logs.sqlite';

describe('Server Logging', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }

    initializeLogging({
      databaseFilename: TEST_DB,
      enableConsoleLogging: false,
    });
  });

  describe('Basic Logging', () => {
    it('should log info messages', () => {
      const db = getDatabase();
      db.run('DELETE FROM log_events', []);
      
      logInfo('Test info message');
      
      const logs = db.list('SELECT * FROM log_events WHERE level = ?', ['info']);
      
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test info message');
      expect(logs[0].level).toBe('info');
    });

    it('should log warn messages', () => {
      const db = getDatabase();
      db.run('DELETE FROM log_events', []);
      
      logWarn('Test warning message');
      
      const logs = db.list('SELECT * FROM log_events WHERE level = ?', ['warn']);
      
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test warning message');
      expect(logs[0].level).toBe('warn');
    });

    it('should log error messages', () => {
      const db = getDatabase();
      db.run('DELETE FROM log_events', []);
      
      logError('Test error message');
      
      const logs = db.list('SELECT * FROM log_events WHERE level = ?', ['error']);
      
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test error message');
      expect(logs[0].level).toBe('error');
    });

    it('should capture stack traces', () => {
      const db = getDatabase();
      db.run('DELETE FROM log_events', []);
      db.run('DELETE FROM log_event_stacks', []);
      
      logError('Test error with stack');
      
      const logs = db.list('SELECT * FROM log_events WHERE level = ?', ['error']);
      const stacks = db.list('SELECT * FROM log_event_stacks WHERE log_event_id = ?', [logs[0].id]);
      
      expect(stacks).toHaveLength(1);
      expect(stacks[0].stack_trace_text).toContain('at');
    });

    it('should capture error stack traces when error object is provided', () => {
      const db = getDatabase();
      db.run('DELETE FROM log_events', []);
      db.run('DELETE FROM log_event_stacks', []);
      
      const error = new Error('Test error');
      logError('Test error with error object', error);
      
      const logs = db.list('SELECT * FROM log_events WHERE level = ?', ['error']);
      const stacks = db.list('SELECT * FROM log_event_stacks WHERE log_event_id = ?', [logs[0].id]);
      
      expect(stacks).toHaveLength(1);
      expect(stacks[0].stack_trace_text).toContain('Test error');
    });
  });

  describe('Session Management', () => {
    it('should log with request session', () => {
      withRequestSession(() => {
        logInfo('Message with request session');
      });
      
      const db = getDatabase();
      const logs = db.list('SELECT * FROM log_events WHERE message = ?', ['Message with request session']);
      
      expect(logs).toHaveLength(1);
      expect(logs[0].request_session_id).toBeTruthy();
      
      const sessions = db.list('SELECT * FROM request_sessions WHERE id = ?', [logs[0].request_session_id]);
      expect(sessions).toHaveLength(1);
    });

    it('should log with test session', () => {
      withRequestSession(() => {
        const testSessionId = createTestSession('test-guid-123');
        setTestSession(testSessionId);
        logInfo('Message with test session');
      });
      
      const db = getDatabase();
      const logs = db.list('SELECT * FROM log_events WHERE message = ?', ['Message with test session']);
      
      expect(logs).toHaveLength(1);
      expect(logs[0].test_session_id).toBeTruthy();
    });

    it('should log with user id', () => {
      withRequestSession(() => {
        setUserId(123);
        logInfo('Message with user id');
      });
      
      const db = getDatabase();
      const logs = db.list('SELECT * FROM log_events WHERE message = ?', ['Message with user id']);
      
      expect(logs).toHaveLength(1);
      expect(logs[0].user_id).toBe(123);
      
      // Check that user was created
      const users = db.list('SELECT * FROM tracked_users WHERE id = ?', [123]);
      expect(users).toHaveLength(1);
    });

    it('should handle nested sessions correctly', () => {
      const db = getDatabase();
      db.run('DELETE FROM log_events', []);
      db.run('DELETE FROM request_sessions', []);
      
      withRequestSession(() => {
        logInfo('Outer session message');
        
        withRequestSession(() => {
          logInfo('Inner session message');
        });
      });
      
      const logs = db.list('SELECT * FROM log_events ORDER BY id', []);
      
      expect(logs).toHaveLength(2);
      expect(logs[0].request_session_id).not.toBe(logs[1].request_session_id);
    });
  });

  describe('Session Incremental IDs', () => {
    it('should assign incremental session IDs starting from 1', () => {
      const db = getDatabase();
      db.run('DELETE FROM log_events', []);
      db.run('DELETE FROM request_sessions', []);
      
      withRequestSession(() => {
        logInfo('First message');
        logInfo('Second message');
        logInfo('Third message');
      });
      
      const logs = db.list('SELECT * FROM log_events ORDER BY id', []);
      
      expect(logs).toHaveLength(3);
      expect(logs[0].session_inc_id).toBe(1);
      expect(logs[1].session_inc_id).toBe(2);
      expect(logs[2].session_inc_id).toBe(3);
    });

    it('should reset session_inc_id for each new request session', () => {
      const db = getDatabase();
      db.run('DELETE FROM log_events', []);
      db.run('DELETE FROM request_sessions', []);
      
      withRequestSession(() => {
        logInfo('First request - message 1');
        logInfo('First request - message 2');
      });
      
      withRequestSession(() => {
        logInfo('Second request - message 1');
        logInfo('Second request - message 2');
      });
      
      const logs = db.list('SELECT * FROM log_events ORDER BY id', []);
      
      expect(logs).toHaveLength(4);
      
      // First request session
      expect(logs[0].session_inc_id).toBe(1);
      expect(logs[1].session_inc_id).toBe(2);
      
      // Second request session (should reset to 1)
      expect(logs[2].session_inc_id).toBe(1);
      expect(logs[3].session_inc_id).toBe(2);
      
      // Verify different request sessions
      expect(logs[0].request_session_id).not.toBe(logs[2].request_session_id);
    });

    it('should handle session_inc_id when no session context exists', () => {
      const db = getDatabase();
      db.run('DELETE FROM log_events', []);
      
      // Log outside of any session context
      logInfo('No session message');
      
      const logs = db.list('SELECT * FROM log_events', []);
      
      expect(logs).toHaveLength(1);
      expect(logs[0].session_inc_id).toBeNull();
      expect(logs[0].request_session_id).toBeNull();
    });
  });

  describe('Message Truncation', () => {
    it('should not truncate messages under the limit', () => {
      const db = getDatabase();
      db.run('DELETE FROM log_events', []);
      
      const normalMessage = 'This is a normal log message that is well under the limit';
      logInfo(normalMessage);
      
      const logs = db.list('SELECT * FROM log_events', []);
      
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe(normalMessage);
    });

    it('should truncate very long messages', () => {
      const db = getDatabase();
      db.run('DELETE FROM log_events', []);
      
      // Create a message larger than 64KB
      const longMessage = 'x'.repeat(70000);
      logInfo(longMessage);
      
      const logs = db.list('SELECT * FROM log_events', []);
      
      expect(logs).toHaveLength(1);
      expect(logs[0].message.length).toBeLessThanOrEqual(65536);
      expect(logs[0].message).toContain('... (truncated from 70000 to 65536 characters)');
      expect(logs[0].message.startsWith('xxxx')).toBe(true);
    });

    it('should truncate very long stack traces', () => {
      const db = getDatabase();
      db.run('DELETE FROM log_events', []);
      db.run('DELETE FROM log_event_stacks', []);
      
      // Create an error with a very long stack trace
      const longStackMessage = 'x'.repeat(70000);
      const error = new Error('Test error');
      // Artificially create a long stack trace
      error.stack = 'Error: Test error\n' + longStackMessage;
      
      logError('Error with long stack', error);
      
      const logs = db.list('SELECT * FROM log_events WHERE level = ?', ['error']);
      const stacks = db.list('SELECT * FROM log_event_stacks WHERE log_event_id = ?', [logs[0].id]);
      
      expect(stacks).toHaveLength(1);
      expect(stacks[0].stack_trace_text.length).toBeLessThanOrEqual(65536);
      expect(stacks[0].stack_trace_text).toContain('... (truncated from');
    });

    it('should handle edge case of exactly max length', () => {
      const db = getDatabase();
      db.run('DELETE FROM log_events', []);
      
      // Create a message exactly at the limit
      const exactMessage = 'x'.repeat(65536);
      logInfo(exactMessage);
      
      const logs = db.list('SELECT * FROM log_events', []);
      
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe(exactMessage); // Should not be truncated
      expect(logs[0].message.length).toBe(65536);
    });

    it('should handle null and empty messages', () => {
      const db = getDatabase();
      db.run('DELETE FROM log_events', []);
      
      logInfo('');
      logInfo(null as any); // Testing edge case
      logInfo(undefined as any); // Testing edge case
      
      const logs = db.list('SELECT * FROM log_events ORDER BY id', []);
      
      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe('');
      expect(logs[1].message).toBe(''); // null becomes empty string
      expect(logs[2].message).toBe(''); // undefined becomes empty string
    });
  });
});