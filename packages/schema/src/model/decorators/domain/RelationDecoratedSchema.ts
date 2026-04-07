import type { DecoratedFieldKind } from './DecoratedFieldKind';
import type { Model } from '../../../domain';
import type { ZodTypeAny } from './ZodTypeAny';

declare const TANGO_DECORATED_FIELD_KIND: unique symbol;

export type RelationDecoratedSchema<
    TSchema extends ZodTypeAny,
    TKind extends DecoratedFieldKind,
    TTargetModel extends Model | never = never,
    TName extends string | undefined = undefined,
    TRelatedName extends string | undefined = undefined,
> = TSchema & {
    readonly [TANGO_DECORATED_FIELD_KIND]: {
        readonly relationKind: TKind;
        readonly targetModel: TTargetModel;
        readonly name: TName;
        readonly relatedName: TRelatedName;
    };
    readonly __tangoRelationDecoratedSchema: {
        readonly relationKind: TKind;
        readonly targetModel: TTargetModel;
        readonly name: TName;
        readonly relatedName: TRelatedName;
    };
};

export type RelationDecoratedSchemaKind<TField> = TField extends {
    readonly __tangoRelationDecoratedSchema: {
        readonly relationKind: infer TKind extends DecoratedFieldKind;
    };
}
    ? TKind
    : never;
