export const schema = {
  name: 'ServerLoggingDatabase',
  statements: [
    `CREATE TABLE tracked_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE test_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guid TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE request_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guid TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE log_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      request_session_id INTEGER,
      test_session_id INTEGER,
      session_inc_id INTEGER,
      level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
      message TEXT,
      params_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES tracked_users(id) ON DELETE CASCADE,
      FOREIGN KEY (request_session_id) REFERENCES request_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (test_session_id) REFERENCES test_sessions(id) ON DELETE CASCADE
    )`,
    
    `CREATE TABLE log_event_stacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_event_id INTEGER NOT NULL,
      stack_trace_text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (log_event_id) REFERENCES log_events(id) ON DELETE CASCADE
    )`,
    
    // Indexes for efficient querying
    `CREATE INDEX idx_log_events_user_id ON log_events(user_id)`,
    `CREATE INDEX idx_log_events_request_session_id ON log_events(request_session_id)`,
    `CREATE INDEX idx_log_events_test_session_id ON log_events(test_session_id)`,
    `CREATE INDEX idx_log_events_session_inc_id ON log_events(session_inc_id)`,
    `CREATE INDEX idx_log_events_created_at ON log_events(created_at)`,
    `CREATE INDEX idx_log_event_stacks_log_event_id ON log_event_stacks(log_event_id)`,
    
    // Composite indexes for optimized queries
    `CREATE INDEX idx_log_events_test_session_created_at ON log_events(test_session_id, created_at, session_inc_id)`,
    `CREATE INDEX idx_log_events_request_session_created_at ON log_events(request_session_id, created_at, session_inc_id)`,
    `CREATE INDEX idx_log_events_level_created_at ON log_events(level, created_at)`,
    `CREATE INDEX idx_log_events_level_user_id ON log_events(level, user_id, created_at)`,
    `CREATE INDEX idx_log_events_level_test_session ON log_events(level, test_session_id, created_at)`,
    `CREATE INDEX idx_log_events_level_request_session ON log_events(level, request_session_id, created_at)`
  ]
};