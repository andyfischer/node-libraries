
import { SqliteDatabase } from "./SqliteDatabase";

export interface IncrementingIdOptions {
    initialValue?: number;
}

export class SingletonIncrementingId {
    db: SqliteDatabase;
    tableName: string;
    options: IncrementingIdOptions;

    constructor(db: SqliteDatabase, tableName: string, options: IncrementingIdOptions = {}) {
        this.db = db;
        this.tableName = tableName;
        this.options = options;
    }

    take() {
        const foundRecord = this.db.get(`SELECT value FROM ${this.tableName}`);

        if (foundRecord) {
            this.db.run(`UPDATE ${this.tableName} SET value = value + 1`);
            return foundRecord.value;
        } else {
            const initialValue = this.options.initialValue ?? 1;
            this.db.run(`INSERT INTO ${this.tableName} (value) VALUES (?)`, [initialValue + 1]);
            return initialValue;
        }
    }
}
