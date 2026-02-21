import type { Logger } from './Logger';
import { ConsoleLogger } from './ConsoleLogger';

type LoggerFactory = (scope: string) => Logger;

let factory: LoggerFactory = (scope) => new ConsoleLogger(scope);

/**
 * Return a `Logger` bound to the given scope name.
 *
 * By default loggers are `ConsoleLogger` instances. Call
 * `setLoggerFactory` to redirect all framework logging
 * to a custom implementation (Pino, Winston, etc.).
 */
export function getLogger(scope: string): Logger {
    return factory(scope);
}

/**
 * Replace the global logger factory used by `getLogger`.
 *
 * Typically called once during application bootstrap from
 * the resolved `TangoConfig.logger` value.
 */
export function setLoggerFactory(custom: LoggerFactory | Logger): void {
    if (typeof custom === 'function') {
        factory = custom;
    } else {
        factory = () => custom;
    }
}

/**
 * Reset the logger factory to the default `ConsoleLogger`.
 * Primarily useful in tests.
 */
export function resetLoggerFactory(): void {
    factory = (scope) => new ConsoleLogger(scope);
}
