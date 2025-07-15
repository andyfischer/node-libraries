import { describe, it, expect, beforeEach } from 'vitest'
import { runMigrationForCreateStatement, MigrationOptions } from '../migration'
import { SqliteDatabase } from '../SqliteDatabase'
import Database from 'better-sqlite3'
import { Stream } from '@andyfischer/streams'

describe('runMigrationForCreateStatement', () => {
    let db: SqliteDatabase

    beforeEach(() => {
        const sqliteDb = new Database(':memory:')
        db = new SqliteDatabase(sqliteDb, Stream.newNullStream());
    })

    describe('PRAGMA statement handling', () => {
        it('should ignore PRAGMA statements and return without error', () => {
            const pragmaStatement = 'PRAGMA foreign_keys = ON'
            
            // Should not throw an error and should return without doing anything
            expect(() => {
                runMigrationForCreateStatement(db, pragmaStatement, {})
            }).not.toThrow()
        })

        it('should ignore PRAGMA statements with function syntax', () => {
            const pragmaStatement = 'PRAGMA table_info(users)'
            
            expect(() => {
                runMigrationForCreateStatement(db, pragmaStatement, {})
            }).not.toThrow()
        })

        it('should ignore PRAGMA statements with equals syntax', () => {
            const pragmaStatement = 'PRAGMA journal_mode = WAL'
            
            expect(() => {
                runMigrationForCreateStatement(db, pragmaStatement, {})
            }).not.toThrow()
        })

        it('should ignore PRAGMA statements without affecting database state', () => {
            // Get initial state
            const initialTables = db.list("SELECT name FROM sqlite_master WHERE type='table'")
            const initialCount = initialTables.length
            
            // Run PRAGMA migration
            runMigrationForCreateStatement(db, 'PRAGMA foreign_keys = ON', {})
            
            // Verify no tables were created or modified
            const finalTables = db.list("SELECT name FROM sqlite_master WHERE type='table'")
            expect(finalTables.length).toBe(initialCount)
        })
    })

    describe('CREATE TABLE statement handling', () => {
        it('should create new table when it does not exist', () => {
            const createStatement = 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)'
            
            runMigrationForCreateStatement(db, createStatement, {})
            
            const tables = db.list("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
            expect(tables).toHaveLength(1)
            expect(tables[0].name).toBe('users')
        })

        it('should handle table migration when table already exists', () => {
            // Create initial table
            db.run('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')
            
            // Try to "migrate" to the same schema (should not error)
            const createStatement = 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)'
            
            expect(() => {
                runMigrationForCreateStatement(db, createStatement, {})
            }).not.toThrow()
        })
    })

    describe('CREATE INDEX statement handling', () => {
        it('should create new index when it does not exist', () => {
            // First create a table for the index
            db.run('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')
            
            const createStatement = 'CREATE INDEX idx_users_name ON users(name)'
            
            runMigrationForCreateStatement(db, createStatement, {})
            
            const indexes = db.list("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_users_name'")
            expect(indexes).toHaveLength(1)
            expect(indexes[0].name).toBe('idx_users_name')
        })

        it('should handle index when it already exists', () => {
            // Create table and index
            db.run('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')
            db.run('CREATE INDEX idx_users_name ON users(name)')
            
            // Try to "migrate" the same index (should not error)
            const createStatement = 'CREATE INDEX idx_users_name ON users(name)'
            
            expect(() => {
                runMigrationForCreateStatement(db, createStatement, {})
            }).not.toThrow()
        })
    })

    describe('unsupported statement handling', () => {
        it('should throw error for INSERT statements', () => {
            const insertStatement = 'INSERT INTO users (name) VALUES ("test")'
            
            expect(() => {
                runMigrationForCreateStatement(db, insertStatement, {})
            }).toThrow('Unsupported statement in migrate()')
        })
    })

    describe('mixed statements in schema', () => {
        it('should handle mix of CREATE and PRAGMA statements properly', () => {
            const options: MigrationOptions = {}
            
            // Should ignore PRAGMA and process CREATE TABLE
            runMigrationForCreateStatement(db, 'PRAGMA foreign_keys = ON', options)
            runMigrationForCreateStatement(db, 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)', options)
            runMigrationForCreateStatement(db, 'PRAGMA journal_mode = WAL', options)
            runMigrationForCreateStatement(db, 'CREATE INDEX idx_users_name ON users(name)', options)
            
            // Verify only the table and index were created
            const tables = db.list("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
            expect(tables).toHaveLength(1)
            
            const indexes = db.list("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_users_name'")
            expect(indexes).toHaveLength(1)
        })
    })
})
