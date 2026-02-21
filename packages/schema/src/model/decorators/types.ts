import type { z } from 'zod';
import type { DeleteReferentialAction, Model, UpdateReferentialAction } from '../../domain/index';

export type ModelRef = string | Model | (() => Model);

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
    relationKind?: 'foreignKey' | 'oneToOne' | 'manyToMany';
}

export type ZodTypeAny = z.ZodTypeAny;
