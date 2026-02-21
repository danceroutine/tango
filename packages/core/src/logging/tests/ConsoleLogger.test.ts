import { describe, it, expect, vi, afterEach } from 'vitest';
import { ConsoleLogger } from '../ConsoleLogger';

describe(ConsoleLogger, () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('prefixes messages with the scope', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const logger = new ConsoleLogger('tango.test');
        logger.error('boom', { detail: 42 });
        expect(spy).toHaveBeenCalledWith('[tango.test]', 'boom', { detail: 42 });
    });

    it('delegates each level to the matching console method', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

        const logger = new ConsoleLogger('scope');
        logger.error('e');
        logger.warn('w');
        logger.info('i');
        logger.debug('d');

        expect(errorSpy).toHaveBeenCalledOnce();
        expect(warnSpy).toHaveBeenCalledOnce();
        expect(infoSpy).toHaveBeenCalledOnce();
        expect(debugSpy).toHaveBeenCalledOnce();
    });
});
