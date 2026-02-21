import type { z } from 'zod';
import type { Model as SchemaModel } from '@danceroutine/tango-schema/domain';
import { registerModelAugmentor } from '@danceroutine/tango-schema';
import { ModelManager } from './ModelManager';
import type { TangoRuntime } from '../runtime/TangoRuntime';
import { getTangoRuntime } from '../runtime/defaultRuntime';

const managerCache = new WeakMap<object, { runtime: TangoRuntime; manager: ModelManager<Record<string, unknown>> }>();
let hasRegisteredModelObjects = false;

function defineObjectsProperty<TSchema extends z.ZodObject<z.ZodRawShape>>(model: SchemaModel<TSchema>): void {
    Object.defineProperty(model, 'objects', {
        configurable: true,
        enumerable: true,
        get() {
            const runtime = getTangoRuntime();
            const cached = managerCache.get(model);
            if (cached && cached.runtime === runtime) {
                return cached.manager;
            }

            const manager = new ModelManager<z.output<TSchema>>(model, runtime);
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
