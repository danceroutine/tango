import type { InternalDecoratedFieldKind } from './DecoratedFieldKind';
import type { RelationDecoratedSchema } from './RelationDecoratedSchema';
import type { ZodTypeAny } from './ZodTypeAny';

export type ManyToManyDecoratedSchema<TSchema extends ZodTypeAny> = RelationDecoratedSchema<
    TSchema,
    typeof InternalDecoratedFieldKind.MANY_TO_MANY
>;
