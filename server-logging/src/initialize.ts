import { initializeDatabase } from "./database";

interface LoggingSettings {
    databaseFilename: string;
    enableConsoleLogging: boolean;
}

let _settings: LoggingSettings | undefined;

export function initializeLogging(settings: LoggingSettings): void {
    if (_settings) {
        throw new Error('Logging already initialized');
    }

    _settings = settings;
    initializeDatabase(settings.databaseFilename);
}

export function getLoggingSettings(): LoggingSettings | undefined {
    return _settings;
}