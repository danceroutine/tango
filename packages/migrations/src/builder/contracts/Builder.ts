import type { MigrationMode } from '../../domain/MigrationMode';
import type { MigrationOperation } from '../../domain/MigrationOperation';

export interface Builder {
    run(...ops: MigrationOperation[]): void;
    data(fn: (ctx: { query(sql: string, params?: readonly unknown[]): Promise<void> }) => Promise<void>): void;
    options(opts: { mode?: MigrationMode }): void;
}
