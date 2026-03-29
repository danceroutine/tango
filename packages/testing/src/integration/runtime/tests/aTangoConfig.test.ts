import { describe, expect, it } from 'vitest';
import { aTangoConfig } from '../aTangoConfig';

describe(aTangoConfig, () => {
    it('builds a sqlite test config by default', () => {
        const config = aTangoConfig();

        expect(config.current).toBe('test');
        expect(config.environments.test.db.adapter).toBe('sqlite');
        expect(config.environments.test.migrations.online).toBe(false);
    });

    it('builds a postgres test config when requested', () => {
        const config = aTangoConfig({ adapter: 'postgres' });

        expect(config.environments.test.db.adapter).toBe('postgres');
        expect(config.environments.test.db.url).toContain('tango_test');
        expect(config.environments.test.migrations.online).toBe(true);
    });
});
