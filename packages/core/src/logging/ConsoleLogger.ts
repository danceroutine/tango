import type { Logger } from './Logger';

/**
 * Default `Logger` implementation that delegates to `console.*`.
 *
 * Each message is prefixed with the scope string so log output is
 * filterable by origin (e.g. `[tango.adapter.next] Adapter error: …`).
 */
export class ConsoleLogger implements Logger {
    constructor(private readonly scope: string) {}

    error(message: string, ...args: unknown[]): void {
        console.error(`[${this.scope}]`, message, ...args);
    }

    warn(message: string, ...args: unknown[]): void {
        console.warn(`[${this.scope}]`, message, ...args);
    }

    info(message: string, ...args: unknown[]): void {
        console.info(`[${this.scope}]`, message, ...args);
    }

    debug(message: string, ...args: unknown[]): void {
        console.debug(`[${this.scope}]`, message, ...args);
    }
}
