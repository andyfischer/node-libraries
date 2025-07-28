export class SlowQueryWarning {
    private startTime: number
    private sql: string
    private warnCallback: (message: string) => void
    private threshold: number

    constructor(sql: string, warnCallback: (message: string) => void, threshold: number = 500) {
        this.sql = sql;
        this.warnCallback = warnCallback;
        this.threshold = threshold;
        this.startTime = Date.now();
    }

    finish() {
        const duration = Date.now() - this.startTime;
        if (duration > this.threshold) {
            this.warnCallback(`Slow query detected (${duration}ms): ${this.sql}`);
        }
    }
}