import { DatabaseLoader, SqliteDatabase } from '@andyfischer/sqlite-wrapper';
import { schema } from './schema';
import { Stream } from '@andyfischer/streams'
import * as path from 'path';

let _db: DatabaseLoader | null = null;

export function initializeDatabase(filename: string): void {
  if (_db) {
    throw new Error('Database already initialized');
  }
  
  _db = new DatabaseLoader({
    filename,
    schema: schema,
    logs: (new Stream()).logToConsole(),
  });
}

export function resetDatabase(): void {
  _db = null;
}

export function getDatabase(): SqliteDatabase {
  if (!_db) {
    throw new Error('Database not initialized');
  }
  return _db!.load();
}
