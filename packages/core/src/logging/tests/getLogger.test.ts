import { describe, it, expect, afterEach } from 'vitest';
import { getLogger, setLoggerFactory, resetLoggerFactory } from '../getLogger';
import { ConsoleLogger } from '../ConsoleLogger';
import type { Logger } from '../Logger';

describe(getLogger, () => {
    afterEach(() => {
        resetLoggerFactory();
    });

    it('returns a ConsoleLogger by default', () => {
        const logger = getLogger('tango.test');
        expect(logger).toBeInstanceOf(ConsoleLogger);
    });

    it('uses a custom factory when set', () => {
        const custom: Logger = {
            error: () => {},
            warn: () => {},
            info: () => {},
            debug: () => {},
        };
        setLoggerFactory(() => custom);

        expect(getLogger('any.scope')).toBe(custom);
    });

    it('accepts a single Logger instance instead of a factory', () => {
        const custom: Logger = {
            error: () => {},
            warn: () => {},
            info: () => {},
            debug: () => {},
        };
        setLoggerFactory(custom);

        expect(getLogger('scope.a')).toBe(custom);
        expect(getLogger('scope.b')).toBe(custom);
    });

    it('resets to ConsoleLogger after resetLoggerFactory', () => {
        setLoggerFactory({ error: () => {}, warn: () => {}, info: () => {}, debug: () => {} });
        resetLoggerFactory();

        expect(getLogger('tango.reset')).toBeInstanceOf(ConsoleLogger);
    });
});
