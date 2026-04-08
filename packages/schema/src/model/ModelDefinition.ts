import { z } from 'zod';
import type { Field, IndexDef, PersistedModelOutput, RelationDef } from '../domain/index';
import type { ModelWriteHooks } from '../domain/index';
import type { RelationBuilder } from './relations/RelationBuilder';
import type { ModelRegistry } from './registry/ModelRegistry';

export interface ModelDefinition<TSchema extends z.ZodObject<z.ZodRawShape>> {
    namespace: string;
    name: string;
    table?: string;
    schema: TSchema;
    registry?: ModelRegistry;
    fields?: Field[];
    indexes?: IndexDef[];
    relations?: (builder: RelationBuilder) => Record<string, RelationDef>;
    ordering?: string[];
    managed?: boolean;
    defaultRelatedName?: string;
    constraints?: unknown[];
    /**
     * Model-owned write lifecycle hooks that run inside `Model.objects`.
     */
    hooks?: ModelWriteHooks<PersistedModelOutput<TSchema>>;
}
