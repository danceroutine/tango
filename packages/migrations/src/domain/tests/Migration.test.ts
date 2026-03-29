import { describe, expect, it } from 'vitest';
import { Migration } from '../Migration';
import type { Builder } from '../../builder/contracts/Builder';

class SampleMigration extends Migration {
    id = '001_sample';
    up(_m: Builder): void {}
    down(_m: Builder): void {}
}

class ThrowingCtorMigration extends Migration {
    id = '002_throwing';
    constructor() {
        super();
        throw new Error('should not instantiate');
    }
    up(_m: Builder): void {}
    down(_m: Builder): void {}
}

function Plain() {}

describe(Migration, () => {
    it('identifies migration instances and constructors', () => {
        const migration = new SampleMigration();
        expect(Migration.isMigration(migration)).toBe(true);
        expect(Migration.isMigration({})).toBe(false);

        expect(Migration.isMigrationConstructor(SampleMigration)).toBe(true);
        expect(Migration.isMigrationConstructor(ThrowingCtorMigration)).toBe(true);
        expect(Migration.isMigrationConstructor(() => ({ id: 'x' }))).toBe(false);
        expect(Migration.isMigrationConstructor(Plain)).toBe(false);
        expect(Migration.isMigrationConstructor({})).toBe(false);
    });
});
