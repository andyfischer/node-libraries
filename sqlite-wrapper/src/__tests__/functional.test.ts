import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseLoader, DatabaseSchema } from '..'
import { existsSync, unlinkSync, readdirSync } from 'fs'
import { join } from 'path'
import { Stream } from '@andyfischer/streams'

const TEST_DB_DIR = './test/dbs'

function cleanupTestDatabases() {
    if (existsSync(TEST_DB_DIR)) {
        const files = readdirSync(TEST_DB_DIR)
        files.forEach(file => {
            if (file.endsWith('.db')) {
                unlinkSync(join(TEST_DB_DIR, file))
            }
        })
    }
}

describe('SQLite Helper Functional Tests', () => {
    beforeEach(() => {
        cleanupTestDatabases()
    })

    it('should initialize a database with schema and verify creation', () => {
        const dbPath = join(TEST_DB_DIR, 'test1.db')
        
        const schema: DatabaseSchema = {
            name: 'test_schema',
            statements: [
                'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE)',
                'CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT, content TEXT, FOREIGN KEY(user_id) REFERENCES users(id))'
            ]
        }

        const loader = new DatabaseLoader({
            filename: dbPath,
            logs: Stream.newNullStream(),
            schema: schema
        })

        const db = loader.load()

        // Verify database file was created
        expect(existsSync(dbPath)).toBe(true)

        // Verify tables were created
        const tables = db.list("SELECT name FROM sqlite_master WHERE type='table'")
        const tableNames = tables.map(t => t.name).sort()
        expect(tableNames).toEqual(['posts', 'users'])

        // Verify table schema
        const userColumns = db.list("PRAGMA table_info(users)")
        expect(userColumns).toHaveLength(3)
        expect(userColumns.map(col => col.name)).toEqual(['id', 'name', 'email'])

        const postColumns = db.list("PRAGMA table_info(posts)")
        expect(postColumns).toHaveLength(4)
        expect(postColumns.map(col => col.name)).toEqual(['id', 'user_id', 'title', 'content'])

        db.close()
    })

    it('should auto-migrate database when schema changes (add column)', () => {
        const dbPath = join(TEST_DB_DIR, 'test2.db')
        
        // Initial schema
        const initialSchema: DatabaseSchema = {
            name: 'test_schema_v1',
            statements: [
                'CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL)'
            ]
        }

        // Create database with initial schema
        const loader1 = new DatabaseLoader({
            filename: dbPath,
            logs: Stream.newNullStream(),
            schema: initialSchema
        })
        
        let db = loader1.load()
        
        // Insert some test data
        db.insert('products', { name: 'Test Product', price: 19.99 })
        
        // Verify initial data
        const initialProducts = db.list('SELECT * FROM products')
        expect(initialProducts).toHaveLength(1)
        expect(initialProducts[0].name).toBe('Test Product')
        
        // Check initial schema
        const initialColumns = db.list("PRAGMA table_info(products)")
        expect(initialColumns).toHaveLength(3)
        expect(initialColumns.map(col => col.name)).toEqual(['id', 'name', 'price'])
        
        db.close()

        // Updated schema with new column
        const updatedSchema: DatabaseSchema = {
            name: 'test_schema_v2',
            statements: [
                'CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL, description TEXT)'
            ]
        }

        // Load database with updated schema (should trigger migration)
        const loader2 = new DatabaseLoader({
            filename: dbPath,
            logs: Stream.newNullStream(),
            schema: updatedSchema
        })
        
        db = loader2.load()

        // Verify migration occurred - check new column exists
        const updatedColumns = db.list("PRAGMA table_info(products)")
        expect(updatedColumns).toHaveLength(4)
        expect(updatedColumns.map(col => col.name)).toEqual(['id', 'name', 'price', 'description'])

        // Verify existing data was preserved
        const productsAfterMigration = db.list('SELECT * FROM products')
        expect(productsAfterMigration).toHaveLength(1)
        expect(productsAfterMigration[0].name).toBe('Test Product')
        expect(productsAfterMigration[0].price).toBe(19.99)
        expect(productsAfterMigration[0].description).toBeNull() // New column should be null for existing data

        // Verify we can insert data with new column
        db.insert('products', { name: 'New Product', price: 29.99, description: 'A new product with description' })
        
        const allProducts = db.list('SELECT * FROM products ORDER BY id')
        expect(allProducts).toHaveLength(2)
        expect(allProducts[1].description).toBe('A new product with description')

        db.close()
    })
})
