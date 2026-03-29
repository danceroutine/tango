import { isTrustedSqlFragment } from '@danceroutine/tango-core';
import type {
    MigrationOperation,
    TableCreate,
    TableDrop,
    ColumnAdd,
    ColumnDrop,
    ColumnAlter,
    ColumnRename,
    IndexCreate,
    IndexDrop,
    ForeignKeyCreate,
    ForeignKeyDrop,
} from '../domain/MigrationOperation';
import type { ColumnSpec } from '../builder/contracts/ColumnSpec';
import { InternalOperationKind } from '../domain/internal/InternalOperationKind';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Input contract for generating a migration source file.
 */
export interface GenerateMigrationOptions {
    /** Human-readable suffix used in file name/id generation. */
    name: string;
    /** Ordered migration operations to render. */
    operations: MigrationOperation[];
    /** Output directory for generated migration files. */
    directory: string;
}

/**
 * Source generator for class-based migration files.
 */
export class MigrationGenerator {
    static readonly BRAND = 'tango.migrations.generator' as const;
    readonly __tangoBrand: typeof MigrationGenerator.BRAND = MigrationGenerator.BRAND;

    /**
     * Narrow an unknown value to `MigrationGenerator`.
     */
    static isMigrationGenerator(value: unknown): value is MigrationGenerator {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === MigrationGenerator.BRAND
        );
    }

    /**
     * Generate a migration file and write it to disk.
     * Returns the file path of the created migration.
     */
    async generate(options: GenerateMigrationOptions): Promise<string> {
        const { name, operations, directory } = options;

        if (operations.length === 0) {
            throw new Error('No operations to generate — models and database are in sync');
        }

        const timestamp = this.timestamp();
        const id = `${timestamp}_${name}`;
        const filename = `${id}.ts`;
        const filepath = join(directory, filename);

        const source = this.render(id, operations);

        await mkdir(directory, { recursive: true });
        await writeFile(filepath, source, 'utf-8');

        return filepath;
    }

    /**
     * Render migration operations to a TypeScript source string without writing to disk.
     */
    render(id: string, operations: MigrationOperation[]): string {
        const upOps = operations.map((operation) => this.renderOperation(operation));
        const downOps = operations.map((operation) => this.renderReverseOperation(operation));
        downOps.reverse();
        const className = this.renderClassName(id);

        const lines = [
            `import { Migration, op, trustedSql, type Builder } from '@danceroutine/tango-migrations';`,
            ``,
            `export default class ${className} extends Migration {`,
            `  id = '${id}';`,
            ``,
            `  up(m: Builder) {`,
            `    m.run(`,
            ...upOps.map((code: string, index: number) => {
                const comma = index < upOps.length - 1 ? ',' : '';
                return `      ${code}${comma}`;
            }),
            `    );`,
            `  }`,
            ``,
            `  down(m: Builder) {`,
            `    m.run(`,
            ...downOps.map((code: string, index: number) => {
                const comma = index < downOps.length - 1 ? ',' : '';
                return `      ${code}${comma}`;
            }),
            `    );`,
            `  }`,
            `}`,
            ``,
        ];

        return lines.join('\n');
    }

    private renderClassName(id: string): string {
        const normalized = id.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^(\d)/, '_$1');
        return `Migration_${normalized}`;
    }

    private renderOperation(operation: MigrationOperation): string {
        switch (operation.kind) {
            case InternalOperationKind.TABLE_CREATE:
                return this.renderTableCreate(operation);
            case InternalOperationKind.TABLE_DROP:
                return this.renderTableDrop(operation);
            case InternalOperationKind.COLUMN_ADD:
                return this.renderColumnAdd(operation);
            case InternalOperationKind.COLUMN_DROP:
                return this.renderColumnDrop(operation);
            case InternalOperationKind.COLUMN_ALTER:
                return this.renderColumnAlter(operation);
            case InternalOperationKind.COLUMN_RENAME:
                return this.renderColumnRename(operation);
            case InternalOperationKind.INDEX_CREATE:
                return this.renderIndexCreate(operation);
            case InternalOperationKind.INDEX_DROP:
                return this.renderIndexDrop(operation);
            case InternalOperationKind.FK_CREATE:
                return this.renderForeignKeyCreate(operation);
            case InternalOperationKind.FK_DROP:
                return this.renderForeignKeyDrop(operation);
            case InternalOperationKind.FK_VALIDATE:
                return `op.foreignKeyValidate({ table: '${operation.table}', name: '${operation.name}' })`;
            case 'custom':
                return `/* custom operation '${operation.name}' cannot be code-generated */`;
            default:
                return `/* unsupported operation */`;
        }
    }

    private renderReverseOperation(operation: MigrationOperation): string {
        switch (operation.kind) {
            case InternalOperationKind.TABLE_CREATE:
                return `op.table('${operation.table}').drop()`;
            case InternalOperationKind.TABLE_DROP:
                return `/* manual reverse required: recreate dropped table '${operation.table}' */`;
            case InternalOperationKind.COLUMN_ADD:
                return `op.table('${operation.table}').dropColumn('${operation.column.name}')`;
            case InternalOperationKind.COLUMN_DROP:
                return `/* manual reverse required: restore dropped column '${operation.column}' */`;
            case InternalOperationKind.COLUMN_ALTER:
                return `/* manual reverse required: revert ALTER COLUMN '${operation.column}' on '${operation.table}' */`;
            case InternalOperationKind.COLUMN_RENAME:
                return `op.table('${operation.table}').renameColumn('${operation.to}', '${operation.from}')`;
            case InternalOperationKind.INDEX_CREATE:
                return `op.index.drop({ name: '${operation.name}', table: '${operation.table}' })`;
            case InternalOperationKind.INDEX_DROP:
                return `/* manual reverse required: recreate dropped index '${operation.name}' */`;
            case InternalOperationKind.FK_CREATE:
                return `op.foreignKeyDrop({ table: '${operation.table}', name: '${operation.name ?? `${operation.table}_${operation.columns.join('_')}_fkey`}' })`;
            case InternalOperationKind.FK_DROP:
                return `/* manual reverse required: recreate dropped FK '${operation.name}' */`;
            case InternalOperationKind.FK_VALIDATE:
                return `/* no reverse needed for FK_VALIDATE */`;
            case 'custom':
                return `/* manual reverse required: custom operation '${operation.name}' */`;
            default:
                return `/* unsupported reverse operation */`;
        }
    }

    private renderTableCreate(operation: TableCreate): string {
        const columnLines = operation.columns.map((col) => {
            const chain = this.renderColumnChain(col);
            return `        cols.add('${col.name}', (b) => b${chain});`;
        });

        return [`op.table('${operation.table}').create((cols) => {`, ...columnLines, `      })`].join('\n');
    }

    private renderTableDrop(operation: TableDrop): string {
        if (operation.cascade) {
            return `op.table('${operation.table}').drop({ cascade: true })`;
        }
        return `op.table('${operation.table}').drop()`;
    }

    private renderColumnAdd(operation: ColumnAdd): string {
        const chain = this.renderColumnChain(operation.column);
        return `op.table('${operation.table}').addColumn('${operation.column.name}', (b) => b${chain})`;
    }

    private renderColumnDrop(operation: ColumnDrop): string {
        return `op.table('${operation.table}').dropColumn('${operation.column}')`;
    }

    private renderColumnAlter(operation: ColumnAlter): string {
        const parts: string[] = [];
        if (operation.to.type) {
            parts.push(`type: '${operation.to.type}'`);
        }
        if (operation.to.notNull !== undefined) {
            parts.push(`notNull: ${operation.to.notNull}`);
        }
        if (operation.to.default !== undefined) {
            if (operation.to.default === null) {
                parts.push(`default: null`);
            } else if (this.isNowDefault(operation.to.default)) {
                parts.push(`default: { now: true }`);
            } else if (isTrustedSqlFragment(operation.to.default)) {
                parts.push(`default: trustedSql(${JSON.stringify(operation.to.default.sql)})`);
            }
        }
        return `op.table('${operation.table}').alterColumn('${operation.column}', { ${parts.join(', ')} })`;
    }

    private renderColumnRename(operation: ColumnRename): string {
        return `op.table('${operation.table}').renameColumn('${operation.from}', '${operation.to}')`;
    }

    private renderIndexCreate(operation: IndexCreate): string {
        const parts: string[] = [
            `name: '${operation.name}'`,
            `table: '${operation.table}'`,
            `on: [${operation.on.map((c) => `'${c}'`).join(', ')}]`,
        ];
        if (operation.unique) {
            parts.push(`unique: true`);
        }
        if (operation.where) {
            parts.push(`where: trustedSql(${JSON.stringify(operation.where.sql)})`);
        }
        if (operation.concurrently) {
            parts.push(`concurrently: true`);
        }
        return `op.index.create({ ${parts.join(', ')} })`;
    }

    private renderIndexDrop(operation: IndexDrop): string {
        return `op.index.drop({ name: '${operation.name}', table: '${operation.table}' })`;
    }

    private renderForeignKeyCreate(operation: ForeignKeyCreate): string {
        const parts: string[] = [
            `table: '${operation.table}'`,
            `columns: [${operation.columns.map((c) => `'${c}'`).join(', ')}]`,
            `references: { table: '${operation.refTable}', columns: [${operation.refColumns.map((c) => `'${c}'`).join(', ')}] }`,
        ];
        if (operation.name) {
            parts.push(`name: '${operation.name}'`);
        }
        if (operation.onDelete) {
            parts.push(`onDelete: '${operation.onDelete}'`);
        }
        if (operation.onUpdate) {
            parts.push(`onUpdate: '${operation.onUpdate}'`);
        }
        if (operation.notValid) {
            parts.push(`notValid: true`);
        }
        return `op.foreignKey({ ${parts.join(', ')} })`;
    }

    private renderForeignKeyDrop(operation: ForeignKeyDrop): string {
        return `op.foreignKeyDrop({ table: '${operation.table}', name: '${operation.name}' })`;
    }

    private renderColumnChain(col: ColumnSpec): string {
        const parts: string[] = [];

        if (col.type) {
            parts.push(`.${col.type}()`);
        }
        if (col.notNull) {
            parts.push(`.notNull()`);
        }
        if (col.default !== undefined && col.default !== null) {
            if (this.isNowDefault(col.default)) {
                parts.push(`.defaultNow()`);
            } else if (isTrustedSqlFragment(col.default)) {
                parts.push(`.default(trustedSql(${JSON.stringify(col.default.sql)}))`);
            }
        } else if (col.default === null) {
            parts.push(`.default(null)`);
        }
        if (col.primaryKey) {
            parts.push(`.primaryKey()`);
        }
        if (col.unique) {
            parts.push(`.unique()`);
        }
        if (col.references) {
            const refParts: string[] = [];
            if (col.references.onDelete) {
                refParts.push(`onDelete: '${col.references.onDelete}'`);
            }
            if (col.references.onUpdate) {
                refParts.push(`onUpdate: '${col.references.onUpdate}'`);
            }
            const opts = refParts.length > 0 ? `, { ${refParts.join(', ')} }` : '';
            parts.push(`.references('${col.references.table}', '${col.references.column}'${opts})`);
        }

        return parts.join('');
    }

    private timestamp(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}${hours}${minutes}${seconds}`;
    }

    private isNowDefault(value: ColumnSpec['default']): value is { now: true } {
        return typeof value === 'object' && value !== null && 'now' in value && value.now === true;
    }
}
