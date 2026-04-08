import type { DecoratedFieldKind } from './DecoratedFieldKind';
import type { ZodTypeAny } from './ZodTypeAny';

declare const TANGO_DECORATED_FIELD_KIND: unique symbol;

export type RelationDecoratedSchema<TSchema extends ZodTypeAny, TKind extends DecoratedFieldKind> = TSchema & {
    readonly [TANGO_DECORATED_FIELD_KIND]: {
        readonly relationKind: TKind;
    };
};
