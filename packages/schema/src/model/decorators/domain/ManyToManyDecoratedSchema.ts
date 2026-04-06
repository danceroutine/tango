import type { INTERNAL_DECORATED_FIELD_KIND } from './DecoratedFieldKind';
import type { RelationDecoratedSchema } from './RelationDecoratedSchema';
import type { ZodTypeAny } from './ZodTypeAny';

export type ManyToManyDecoratedSchema<TSchema extends ZodTypeAny> = RelationDecoratedSchema<
    TSchema,
    typeof INTERNAL_DECORATED_FIELD_KIND.MANY_TO_MANY
>;
