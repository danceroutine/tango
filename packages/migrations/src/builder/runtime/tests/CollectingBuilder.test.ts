import { describe, expect, it } from 'vitest';
import { CollectingBuilder } from '../CollectingBuilder';
import { InternalOperationKind } from '../../../domain/internal/InternalOperationKind';
import { InternalMigrationMode } from '../../../domain/internal/InternalMigrationMode';

const dataFn = async () => {};

describe(CollectingBuilder, () => {
    it('records operations, data steps, and execution mode changes', async () => {
        const builder = new CollectingBuilder();

        builder.run({ kind: InternalOperationKind.TABLE_DROP, table: 'users' });
        builder.data(dataFn);
        builder.options({ mode: InternalMigrationMode.ONLINE });

        expect(builder.ops).toEqual([{ kind: InternalOperationKind.TABLE_DROP, table: 'users' }]);
        expect(builder.dataFns).toEqual([dataFn]);
        expect(builder.getMode()).toBe(InternalMigrationMode.ONLINE);
        expect(CollectingBuilder.isCollectingBuilder(builder)).toBe(true);
        expect(CollectingBuilder.isCollectingBuilder({})).toBe(false);
    });
});
