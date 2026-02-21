/**
 * Minimal logging interface for the Tango framework.
 *
 * Consumers may provide their own implementation (Pino, Winston, etc.)
 * via `TangoConfig.logger`. The framework never makes assumptions about
 * transports, formatting, or log levels beyond these four methods.
 */
export interface Logger {
    error(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
}
