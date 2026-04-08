import type { z } from 'zod';
import type { ModelManager } from '../manager/ModelManager';
import type { Model, PersistedModelOutput } from '@danceroutine/tango-schema/domain';
import { registerModelObjects } from '../manager/registerModelObjects';

/**
 * Domain boundary barrel: centralizes Tango runtime ownership APIs.
 */

declare global {
    interface TangoSchemaModelAugmentations<
        TSchema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
        TKey extends string = string,
    > {
        readonly objects: ModelManager<PersistedModelOutput<TSchema>, Model<TSchema, TKey>>;
    }
}

registerModelObjects();

export { registerModelObjects } from '../manager/registerModelObjects';
export { TangoRuntime } from './TangoRuntime';
export { getTangoRuntime, initializeTangoRuntime, resetTangoRuntime } from './defaultRuntime';
