import { describe, it, expect } from 'vitest';
import { defineConfig } from '../defineConfig';

describe(defineConfig, () => {
    it('validates and returns config', () => {
        const config = defineConfig({
            current: 'development',
            environments: {
                development: {
                    name: 'development',
                    db: {
                        adapter: 'sqlite',
                        filename: ':memory:',
                    },
                },
                test: {
                    name: 'test',
                    db: {
                        adapter: 'sqlite',
                        filename: ':memory:',
                    },
                },
                production: {
                    name: 'production',
                    db: {
                        adapter: 'postgres',
                        url: 'postgres://localhost/prod',
                    },
                },
            },
        });

        expect(config.current).toBe('development');
        expect(config.environments.development.db.adapter).toBe('sqlite');
    });

    it('throws on invalid config', () => {
        expect(() =>
            defineConfig({
                current: 'invalid',
                environments: {},
            })
        ).toThrow();
    });
});
