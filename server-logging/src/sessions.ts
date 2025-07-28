import { AsyncLocalStorage } from 'async_hooks';
import { randomBytes } from 'crypto';
import { getDatabase } from './database';

export interface SessionContext {
  requestSessionId?: number;
  testSessionId?: number;
  userId?: number;
  nextIncId: number;
}

const asyncLocalStorage = new AsyncLocalStorage<SessionContext>();

export function generateGuid(): string {
  return randomBytes(16).toString('hex');
}

export function createRequestSession(): number {
  const db = getDatabase();
  const guid = generateGuid();
  
  const result = db.run(
    `INSERT INTO request_sessions (guid) VALUES (?)`,
    [guid]
  );
  
  return result.lastInsertRowid as number;
}

export function createTestSession(guid: string): number {
  const db = getDatabase();
  
  // Check if a session with this guid already exists
  const existing = db.get(`SELECT id FROM test_sessions WHERE guid = ?`, [guid]) as { id: number } | undefined;
  
  if (existing) {
    return existing.id;
  }
  
  // Create new session if none exists
  const result = db.run(
    `INSERT INTO test_sessions (guid) VALUES (?)`,
    [guid]
  );
  
  return result.lastInsertRowid as number;
}

export function getOrCreateUser(userId?: number): number | undefined {
  if (!userId) return undefined;
  
  const db = getDatabase();
  
  // Check if user exists
  const exists = db.exists(`FROM tracked_users WHERE id = ?`, [userId]);
  
  if (!exists) {
    // Create user
    db.run(`INSERT INTO tracked_users (id) VALUES (?)`, [userId]);
  }
  
  return userId;
}

export function getCurrentContext(): SessionContext | undefined {
  return asyncLocalStorage.getStore();
}

export function runWithContext<T>(context: SessionContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

export function withRequestSession<T>(fn: () => T): T {
  const requestSessionId = createRequestSession();
  const currentContext = getCurrentContext() || {};
  
  return runWithContext(
    { ...currentContext, requestSessionId, nextIncId: 1 },
    fn
  );
}

export function setTestSession(testSessionId: number): void {
  const currentContext = getCurrentContext();
  if (currentContext) {
    currentContext.testSessionId = testSessionId;
  }
}

export function setUserId(userId: number): void {
  const currentContext = getCurrentContext();
  if (currentContext) {
    currentContext.userId = getOrCreateUser(userId);
  }
}

export function getNextSessionIncId(): number | undefined {
  const currentContext = getCurrentContext();
  if (currentContext) {
    const currentId = currentContext.nextIncId;
    currentContext.nextIncId++;
    return currentId;
  }
  return undefined;
}