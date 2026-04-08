import type { RelationDef } from '../../domain/index';
import { InternalRelationType } from '../../domain/internal/InternalRelationType';

/**
 * Public authoring DSL for model-level named relations.
 *
 * This is the first stage of the relations subdomain. Application code uses it
 * inside `relations: (r) => ({ ... })` to declare stable relation names and
 * resolve ambiguity that field decorators alone cannot express.
 *
 * Later internal stages normalize these authored definitions and combine them
 * with field-authored relation metadata to build the resolved relation graph.
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
