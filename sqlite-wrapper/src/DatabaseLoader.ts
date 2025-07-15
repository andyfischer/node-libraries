
import { SqliteDatabase } from './SqliteDatabase'
import Database from 'better-sqlite3'
import { DatabaseSchema } from './DatabaseSchema';
import { Stream } from '@andyfischer/streams';

export interface SetupOptions {
    filename: string
    schema: DatabaseSchema
    logs: Stream
    onRunStatement?: (sql: string, params: Array<any>) => void
}

export class DatabaseLoader {
    options: SetupOptions
    db: SqliteDatabase | null = null

    constructor(options: SetupOptions) {
        this.options = options;
    }

    load() {
        if (!this.db) {
            this.db = new SqliteDatabase(
                new Database(this.options.filename),
                this.options.logs,
            );

            this.db.migrateToSchema(this.options.schema);
            this.db.runDatabaseSloppynessCheck(this.options.schema);

            if (this.options.onRunStatement) {
                this.db.onRunStatement = this.options.onRunStatement;
            }
        }
        return this.db;
    }
}
