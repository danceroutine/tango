import type { TrustedSqlFragment } from '@danceroutine/tango-core';
import type {
    CustomMigrationOperation,
    ForeignKeyCreate,
    ForeignKeyDrop,
    ForeignKeyValidate,
    IndexCreate,
    IndexDrop,
    TableCreate,
    TableDrop,
    ColumnAdd,
    ColumnDrop,
    ColumnAlter,
    ColumnRename,
} from '../../domain/MigrationOperation';
import type { ColumnSpec } from '../contracts/ColumnSpec';
import type { ColumnType } from '../contracts/ColumnType';
import { InternalColumnType } from '../../domain/internal/InternalColumnType';
import type { DeleteReferentialAction } from '../contracts/DeleteReferentialAction';
import type { UpdateReferentialAction } from '../contracts/UpdateReferentialAction';
import { InternalOperationKind } from '../../domain/internal/InternalOperationKind';

/**
 * Fluent builder for column specifications used by table operations.
 */
class ColumnBuilder {
    static readonly BRAND = 'tango.migrations.column_builder' as const;
    readonly __tangoBrand: typeof ColumnBuilder.BRAND = ColumnBuilder.BRAND;
    private spec: Partial<ColumnSpec> = {};

    constructor(name: string) {
        this.spec.name = name;
    }

    static isColumnBuilder(value: unknown): value is ColumnBuilder {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === ColumnBuilder.BRAND
        );
    }

    /** Set column type to serial/auto-increment. */
    serial(): ColumnBuilder {
        this.spec.type = InternalColumnType.SERIAL;
        return this;
    }
    /** Set column type to integer. */
    int(): ColumnBuilder {
        this.spec.type = InternalColumnType.INT;
        return this;
    }
    /** Set column type to bigint. */
    bigint(): ColumnBuilder {
        this.spec.type = InternalColumnType.BIGINT;
        return this;
    }
    /** Set column type to text. */
    text(): ColumnBuilder {
        this.spec.type = InternalColumnType.TEXT;
        return this;
    }
    /** Set column type to boolean. */
    bool(): ColumnBuilder {
        this.spec.type = InternalColumnType.BOOL;
        return this;
    }
    /** Set column type to timestamptz. */
    timestamptz(): ColumnBuilder {
        this.spec.type = InternalColumnType.TIMESTAMPTZ;
        return this;
    }
    /** Set column type to JSONB. */
    jsonb(): ColumnBuilder {
        this.spec.type = InternalColumnType.JSONB;
        return this;
    }
    /** Set column type to UUID. */
    uuid(): ColumnBuilder {
        this.spec.type = InternalColumnType.UUID;
        return this;
    }

    /** Mark column as NOT NULL. */
    notNull(): ColumnBuilder {
        this.spec.notNull = true;
        return this;
    }
    /** Set default to current timestamp. */
    defaultNow(): ColumnBuilder {
        this.spec.default = { now: true };
        return this;
    }
    /** Set reviewed raw SQL default expression. */
    default(v: TrustedSqlFragment | null): ColumnBuilder {
        this.spec.default = v;
        return this;
    }
    /** Mark column as part of primary key. */
    primaryKey(): ColumnBuilder {
        this.spec.primaryKey = true;
        return this;
    }
    /** Mark column as unique. */
    unique(): ColumnBuilder {
        this.spec.unique = true;
        return this;
    }
    /** Configure foreign key reference metadata. */
    references(
        table: string,
        column: string,
        opts?: {
            onDelete?: DeleteReferentialAction;
            onUpdate?: UpdateReferentialAction;
        }
    ): ColumnBuilder {
        this.spec.references = {
            table,
            column,
            onDelete: opts?.onDelete,
            onUpdate: opts?.onUpdate,
        };
        return this;
    }

    _done(): ColumnSpec {
        return this.spec as ColumnSpec;
    }
}

type TableOperationBuilder = {
    create(def: (cols: { add: (name: string, cb: (b: ColumnBuilder) => ColumnBuilder) => void }) => void): TableCreate;
    drop(opts?: { cascade?: boolean }): TableDrop;
    addColumn(name: string, cb: (b: ColumnBuilder) => ColumnBuilder): ColumnAdd;
    dropColumn(name: string): ColumnDrop;
    alterColumn(name: string, to: Partial<ColumnSpec>): ColumnAlter;
    renameColumn(from: string, to: string): ColumnRename;
};

/**
 * Static factory for migration operations.
 */
export class OpBuilder {
    static readonly BRAND = 'tango.migrations.op_builder' as const;
    static index = {
        /** Build an index create operation. */
        create(p: {
            name: string;
            table: string;
            on: string[];
            unique?: boolean;
            where?: TrustedSqlFragment;
            concurrently?: boolean;
        }): IndexCreate {
            return { kind: InternalOperationKind.INDEX_CREATE, ...p };
        },
        /** Build an index drop operation. */
        drop(p: { name: string; table: string; concurrently?: boolean }): IndexDrop {
            return { kind: InternalOperationKind.INDEX_DROP, ...p };
        },
    };
    private static customOperations = new Map<string, (args: Record<string, unknown>) => CustomMigrationOperation>();
    readonly __tangoBrand: typeof OpBuilder.BRAND = OpBuilder.BRAND;

    /**
     * Narrow an unknown value to the shared migration operation builder type.
     */
    static isOpBuilder(value: unknown): value is OpBuilder {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === OpBuilder.BRAND
        );
    }

    /**
     * Build table-scoped migration operations.
     */
    static table(table: string): TableOperationBuilder {
        return {
            create(
                def: (cols: { add: (name: string, cb: (b: ColumnBuilder) => ColumnBuilder) => void }) => void
            ): TableCreate {
                const columns: ColumnSpec[] = [];
                def({
                    add(name, cb) {
                        columns.push(cb(new ColumnBuilder(name))._done());
                    },
                });
                return { kind: InternalOperationKind.TABLE_CREATE, table, columns };
            },
            drop(opts?: { cascade?: boolean }): TableDrop {
                return { kind: InternalOperationKind.TABLE_DROP, table, cascade: opts?.cascade };
            },
            addColumn(name: string, cb: (b: ColumnBuilder) => ColumnBuilder): ColumnAdd {
                return { kind: InternalOperationKind.COLUMN_ADD, table, column: cb(new ColumnBuilder(name))._done() };
            },
            dropColumn(name: string): ColumnDrop {
                return { kind: InternalOperationKind.COLUMN_DROP, table, column: name };
            },
            alterColumn(name: string, to: Partial<ColumnSpec>): ColumnAlter {
                return { kind: InternalOperationKind.COLUMN_ALTER, table, column: name, to };
            },
            renameColumn(from: string, to: string): ColumnRename {
                return { kind: InternalOperationKind.COLUMN_RENAME, table, from, to };
            },
        };
    }

    /** Build a foreign key create operation. */
    static foreignKey(p: {
        table: string;
        name?: string;
        columns: string[];
        references: { table: string; columns: string[] };
        onDelete?: string;
        onUpdate?: string;
        notValid?: boolean;
    }): ForeignKeyCreate {
        return {
            kind: InternalOperationKind.FK_CREATE,
            table: p.table,
            name: p.name,
            columns: p.columns,
            refTable: p.references.table,
            refColumns: p.references.columns,
            onDelete: p.onDelete,
            onUpdate: p.onUpdate,
            notValid: p.notValid,
        };
    }

    /** Build a foreign key validation operation. */
    static foreignKeyValidate(p: { table: string; name: string }): ForeignKeyValidate {
        return { kind: InternalOperationKind.FK_VALIDATE, ...p };
    }

    /** Build a foreign key drop operation. */
    static foreignKeyDrop(p: { table: string; name: string }): ForeignKeyDrop {
        return { kind: InternalOperationKind.FK_DROP, ...p };
    }

    /**
     * Register a custom migration operation builder.
     */
    static registerCustomOperation<TName extends string, TArgs extends object>(
        name: TName,
        builder: (args: TArgs) => CustomMigrationOperation<TName, TArgs>
    ): void {
        this.customOperations.set(name, builder as (args: Record<string, unknown>) => CustomMigrationOperation);
    }

    /**
     * Resolve a previously registered custom operation builder.
     */
    static getCustomOperation<TName extends string, TArgs extends object>(
        name: TName
    ): ((args: TArgs) => CustomMigrationOperation<TName, TArgs>) | undefined {
        return this.customOperations.get(name) as ((args: TArgs) => CustomMigrationOperation<TName, TArgs>) | undefined;
    }
}

/**
 * Apply a domain field type to a column builder.
 */
export function applyFieldType(builder: ColumnBuilder, fieldType: ColumnType): ColumnBuilder {
    switch (fieldType) {
        case InternalColumnType.SERIAL:
            return builder.serial();
        case InternalColumnType.INT:
            return builder.int();
        case InternalColumnType.BIGINT:
            return builder.bigint();
        case InternalColumnType.TEXT:
            return builder.text();
        case InternalColumnType.BOOL:
            return builder.bool();
        case InternalColumnType.TIMESTAMPTZ:
            return builder.timestamptz();
        case InternalColumnType.JSONB:
            return builder.jsonb();
        case InternalColumnType.UUID:
            return builder.uuid();
        default: {
            const exhaustive: never = fieldType;
            throw new Error(`Unsupported field type: ${exhaustive}`);
        }
    }
}
