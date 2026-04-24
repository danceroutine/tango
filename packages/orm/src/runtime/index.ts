import type { z } from 'zod';
import type { ModelManager } from '../manager/ModelManager';
import type { Model } from '@danceroutine/tango-schema/domain';
import type { MaterializedModelRecord } from '../manager/relations/MaterializedModelRecord';
import { registerModelObjects } from '../manager/registerModelObjects';

/**
 * Domain boundary barrel: centralizes Tango runtime ownership APIs.
 */

declare global {
    interface TangoSchemaModelAugmentations<
        TSchema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
        TKey extends string = string,
    > {
        readonly objects: ModelManager<MaterializedModelRecord<TSchema>, Model<TSchema, TKey>>;
    }
}

registerModelObjects();

export { registerModelObjects } from '../manager/registerModelObjects';
export { TangoRuntime } from './TangoRuntime';
export { getTangoRuntime, initializeTangoRuntime, resetTangoRuntime } from './defaultRuntime';
