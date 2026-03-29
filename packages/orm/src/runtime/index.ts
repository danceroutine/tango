import type { z } from 'zod';
import type { ModelManager } from '../manager/ModelManager';
import { registerModelObjects } from '../manager/registerModelObjects';

/**
 * Domain boundary barrel: centralizes Tango runtime ownership APIs.
 */

declare global {
    interface TangoSchemaModelAugmentations<TSchema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>> {
        readonly objects: ModelManager<z.output<TSchema>>;
    }
}

registerModelObjects();

export { registerModelObjects } from '../manager/registerModelObjects';
export { TangoRuntime } from './TangoRuntime';
export { getTangoRuntime, initializeTangoRuntime, resetTangoRuntime } from './defaultRuntime';
