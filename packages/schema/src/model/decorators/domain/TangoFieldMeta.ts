import type { DeleteReferentialAction, UpdateReferentialAction } from '../../../domain';
import type { DecoratedFieldKind } from './DecoratedFieldKind';
import type { ModelRef } from './ModelRef';

export interface ReferentialOptions {
    column?: string;
    onDelete?: DeleteReferentialAction;
    onUpdate?: UpdateReferentialAction;
}

export interface TangoFieldMeta {
    primaryKey?: boolean;
    unique?: boolean;
    notNull?: boolean;
    dbIndex?: boolean;
    dbColumn?: string;
    default?: string | { now: true } | null;
    dbDefault?: string;
    helpText?: string;
    choices?: readonly unknown[];
    validators?: readonly ((value: unknown) => unknown)[];
    errorMessages?: Record<string, string>;
    references?: {
        target: ModelRef;
        options?: ReferentialOptions;
    };
    relationKind?: DecoratedFieldKind;
    forwardName?: string;
    reverseName?: string;
}
