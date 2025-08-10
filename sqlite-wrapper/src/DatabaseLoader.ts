
import { SqliteDatabase } from './SqliteDatabase'
import Database from 'better-sqlite3'
import { DatabaseSchema } from './DatabaseSchema';
import { Stream } from '@andyfischer/streams';
import { parseSql } from './parser';
import { getOneTableMigration } from './migration';

export interface MigrationConfig {
    safeMigrate?: boolean
    dropLeftoverTables?: boolean
    doDestructiveRebuilds?: boolean
}

export interface SetupOptions {
    filename: string
    schema: DatabaseSchema
    logs: Stream
    onRunStatement?: (sql: string, params: Array<any>) => void
    migration?: MigrationConfig
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

            const migrationConfig = this.options.migration || {};
            const safeMigrate = migrationConfig.safeMigrate !== false; // default true
            const dropLeftoverTables = migrationConfig.dropLeftoverTables || false;
            const doDestructiveRebuilds = migrationConfig.doDestructiveRebuilds || false;

            if (safeMigrate) {
                this.db.migrateToSchema(this.options.schema, { 
                    includeDestructive: doDestructiveRebuilds 
                });
            }

            if (doDestructiveRebuilds) {
                this.performDestructiveRebuilds();
            }

            if (dropLeftoverTables) {
                this.dropLeftoverTables();
            }

            this.db.runDatabaseSloppynessCheck(this.options.schema);

            if (this.options.onRunStatement) {
                this.db.onRunStatement = this.options.onRunStatement;
            }
        }
        return this.db;
    }

    private dropLeftoverTables() {
        if (!this.db) return;

        const schemaTables = new Set<string>();
        
        for (const statementText of this.options.schema.statements) {
            const statement = parseSql(statementText);
            
            switch (statement.t) {
            case 'create_table':
                schemaTables.add(statement.name);
                break;
            case 'create_index':
                schemaTables.add(statement.index_name);
                break;
            }
        }

        const existingItems = this.db.list(`select name, type from sqlite_schema where type IN ('table', 'index')`);
        
        for (const { name: itemName, type } of existingItems) {
            if (itemName.startsWith('sqlite_')) continue;
            if (itemName.startsWith('_litestream')) continue;
            if (itemName === 'dm_database_meta') continue;
            
            if (!schemaTables.has(itemName)) {
                if (type === 'table') {
                    this.db.info(`Dropping leftover table: ${itemName}`);
                    this.db.run(`DROP TABLE ${itemName}`);
                } else if (type === 'index') {
                    this.db.info(`Dropping leftover index: ${itemName}`);
                    this.db.run(`DROP INDEX ${itemName}`);
                }
            }
        }
    }

    private performDestructiveRebuilds() {
        if (!this.db) return;

        for (const statementText of this.options.schema.statements) {
            const statement = parseSql(statementText);
            
            if (statement.t !== 'create_table') continue;
            
            const existingTable: any = this.db.get(`select sql from sqlite_schema where name = ?`, statement.name);
            
            if (!existingTable) continue;
            
            const migration = getOneTableMigration(existingTable.sql, statementText);
            
            const needsRebuild = migration.warnings.some(warning => 
                warning.includes('requires a rebuild') || 
                warning.includes('destructive')
            );
            
            if (needsRebuild) {
                this.db.info(`Performing destructive rebuild for table: ${statement.name}`);
                this.db.performRebuild(this.options.schema, statement.name);
            }
        }
    }
}
