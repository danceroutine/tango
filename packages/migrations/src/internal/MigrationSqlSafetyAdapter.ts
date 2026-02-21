import {
    SqlSafetyEngine,
    isTrustedSqlFragment,
    quoteSqlIdentifier,
    type SqlDialect,
    type SqlIdentifierRole,
    type TrustedSqlFragment,
} from '@danceroutine/tango-core';

type IdentifierRole = Extract<SqlIdentifierRole, 'table' | 'column' | 'index' | 'constraint' | 'schema'>;

/**
 * Migrations-local adapter that maps migration operations into the shared SQL
 * safety engine and returns quoted identifiers or trusted raw fragments.
 */
export class MigrationSqlSafetyAdapter {
    constructor(
        private readonly dialect: SqlDialect,
        private readonly engine: SqlSafetyEngine = new SqlSafetyEngine()
    ) {}

    table(value: string): string {
        return this.quote('table', 'table', value);
    }

    column(value: string, allowlist?: readonly string[]): string {
        return this.quote('column', 'column', value, allowlist);
    }

    columns(values: readonly string[], allowlist?: readonly string[]): string[] {
        return values.map((value, index) => this.quote(`column:${index}`, 'column', value, allowlist));
    }

    index(value: string): string {
        return this.quote('index', 'index', value);
    }

    constraint(value: string): string {
        return this.quote('constraint', 'constraint', value);
    }

    schema(value: string): string {
        return this.quote('schema', 'schema', value);
    }

    rawFragment(key: string, value: TrustedSqlFragment): string {
        return this.engine.validate({
            rawFragments: [{ key, value }],
        }).rawFragments[key]!.sql;
    }

    optionalRawFragment(key: string, value?: TrustedSqlFragment): string | undefined {
        if (!value) {
            return undefined;
        }

        return this.rawFragment(key, value);
    }

    rawDefault(
        value: TrustedSqlFragment | { now: true } | null | undefined,
        nowSql: string
    ): string | null | undefined {
        if (value === undefined) {
            return undefined;
        }

        if (value === null) {
            return null;
        }

        if (this.isNowDefault(value)) {
            return nowSql;
        }

        return this.rawFragment('default', value);
    }

    isTrustedFragment(value: unknown): value is TrustedSqlFragment {
        return isTrustedSqlFragment(value);
    }

    private quote(key: string, role: IdentifierRole, value: string, allowlist?: readonly string[]): string {
        const validated = this.engine.validate({
            identifiers: [{ key, role, value, allowlist }],
        });

        return quoteSqlIdentifier(validated.identifiers[key]!, this.dialect);
    }

    private isNowDefault(value: TrustedSqlFragment | { now: true }): value is { now: true } {
        return typeof value === 'object' && value !== null && 'now' in value && value.now === true;
    }
}
