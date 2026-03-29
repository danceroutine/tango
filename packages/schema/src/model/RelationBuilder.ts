import type { RelationDef } from '../domain/index';
import { InternalRelationType } from '../domain/internal/InternalRelationType';

/**
 * Fluent helper for declaring model relation metadata.
 */
export class RelationBuilder {
    /** Declare a one-to-many relation from this model to `target`. */
    hasMany(target: string, foreignKey: string): RelationDef {
        return {
            type: InternalRelationType.HAS_MANY,
            target,
            foreignKey,
        };
    }

    /** Declare an owning relation to a parent model. */
    belongsTo(target: string, foreignKey: string, localKey?: string): RelationDef {
        return {
            type: InternalRelationType.BELONGS_TO,
            target,
            foreignKey,
            localKey,
        };
    }

    /** Declare a one-to-one relation from this model to `target`. */
    hasOne(target: string, foreignKey: string): RelationDef {
        return {
            type: InternalRelationType.HAS_ONE,
            target,
            foreignKey,
        };
    }
}
