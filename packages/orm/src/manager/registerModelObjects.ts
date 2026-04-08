import type { z } from 'zod';
import type { Model as SchemaModel, PersistedModelOutput } from '@danceroutine/tango-schema/domain';
import { registerModelAugmentor } from '@danceroutine/tango-schema';
import { ModelManager } from './ModelManager';
import type { TangoRuntime } from '../runtime/TangoRuntime';
import { getTangoRuntime } from '../runtime/defaultRuntime';

const managerCache = new WeakMap<object, { runtime: TangoRuntime; manager: ModelManager<Record<string, unknown>> }>();
let hasRegisteredModelObjects = false;

type AugmentableSchemaModel<TSchema extends z.ZodObject<z.ZodRawShape>> = {
    metadata: {
        key?: string;
        name: string;
        table: string;
        fields: Array<{ name: string; type: string; primaryKey?: boolean }>;
    };
    schema: {
        parse(input: unknown): PersistedModelOutput<TSchema>;
    };
    hooks?: SchemaModel<TSchema>['hooks'];
};

function defineObjectsProperty<TSchema extends z.ZodObject<z.ZodRawShape>, TKey extends string>(
    model: SchemaModel<TSchema, TKey>
): void {
    Object.defineProperty(model, 'objects', {
        configurable: true,
        enumerable: true,
        get() {
            const runtime = getTangoRuntime();
            const cached = managerCache.get(model);
            if (cached && cached.runtime === runtime) {
                return cached.manager;
            }

            const manager = new ModelManager<PersistedModelOutput<TSchema>, SchemaModel<TSchema, TKey>>(
                model as unknown as AugmentableSchemaModel<TSchema>,
                runtime
            );
            managerCache.set(model, {
                runtime,
                manager: manager as ModelManager<Record<string, unknown>>,
            });
            return manager;
        },
    });
}

/**
 * Install the schema model augmentor that exposes `Model.objects`.
 * This registration is idempotent so multiple Tango entrypoints can safely call it.
 */
export function registerModelObjects(): void {
    if (hasRegisteredModelObjects) {
        return;
    }

    registerModelAugmentor(defineObjectsProperty);
    hasRegisteredModelObjects = true;
}
