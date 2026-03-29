import type { Builder } from '../builder/contracts/Builder';
import type { MigrationMode } from './MigrationMode';

/**
 * Base migration contract.
 *
 * Concrete migrations provide a stable `id` and define reversible schema/data
 * operations through `up` and `down`.
 */
export abstract class Migration {
    static readonly BRAND = 'tango.migration' as const;
    static readonly CONSTRUCTOR_BRAND = 'tango.migration.constructor' as const;
    static readonly __tangoConstructorBrand: typeof Migration.CONSTRUCTOR_BRAND = Migration.CONSTRUCTOR_BRAND;
    readonly __tangoBrand: typeof Migration.BRAND = Migration.BRAND;

    abstract id: string;
    /** Optional execution mode override (`online`/`offline`). */
    mode?: MigrationMode;
    /** Apply migration operations. */
    abstract up(m: Builder): void | Promise<void>;
    /** Revert migration operations. */
    abstract down(m: Builder): void | Promise<void>;

    /**
     * Narrow an unknown value to a migration instance.
     */
    static isMigration(value: unknown): value is Migration {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === Migration.BRAND
        );
    }

    /**
     * Narrow an unknown value to a migration constructor.
     */
    static isMigrationConstructor(value: unknown): value is new () => Migration {
        if (typeof value !== 'function') {
            return false;
        }

        const prototype = (value as { prototype?: unknown }).prototype;
        if (typeof prototype !== 'object' || prototype === null) {
            return false;
        }

        if (
            typeof (prototype as { up?: unknown }).up !== 'function' ||
            typeof (prototype as { down?: unknown }).down !== 'function'
        ) {
            return false;
        }

        return (value as { __tangoConstructorBrand?: unknown }).__tangoConstructorBrand === Migration.CONSTRUCTOR_BRAND;
    }
}
