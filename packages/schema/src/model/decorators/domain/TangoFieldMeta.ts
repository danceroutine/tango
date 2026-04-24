import type { DeleteReferentialAction, UpdateReferentialAction } from '../../../domain';
import type { DecoratedFieldKind } from './DecoratedFieldKind';
import type { ModelRef } from './ModelRef';

/**
 * Options attached to a {@link TangoFieldMeta.references} block for foreign-key-style fields.
 */
export interface ReferentialOptions {
    /**
     * Column on the **referenced** model that this link targets. When omitted, the target model’s
     * primary key is used.
     */
    column?: string;
    /** `ON DELETE` action for the underlying foreign key constraint. */
    onDelete?: DeleteReferentialAction;
    /** `ON UPDATE` action for the underlying foreign key constraint. */
    onUpdate?: UpdateReferentialAction;
}

/**
 * Field-level metadata attached to a Zod schema via decorators. Migrations and relation wiring
 * read this shape when inferring columns, constraints, and graph edges.
 */
export interface TangoFieldMeta {
    /** Marks the backing column as the table primary key. */
    primaryKey?: boolean;
    /** Adds a uniqueness constraint at the database layer. */
    unique?: boolean;
    /** `NOT NULL` for the stored column when applicable. */
    notNull?: boolean;
    /** Creates a btree index on the stored column. */
    dbIndex?: boolean;
    /**
     * Database column name. When set, migrations and DDL use this instead of the object property
     * name.
     */
    dbColumn?: string;
    /**
     * Application-level default used by schema inference and validation (`DEFAULT` clause is
     * derived separately unless {@link dbDefault} is set).
     */
    default?: string | { now: true } | null;
    /** Raw SQL expression for the column’s `DEFAULT` in generated DDL. */
    dbDefault?: string;
    /** Human-oriented description for forms, admin UIs, and generated docs. */
    helpText?: string;
    /** Enumerated allowed values when the field is presented as a choice list. */
    choices?: readonly unknown[];
    /** Runtime validators applied when coercing or checking incoming values. */
    validators?: readonly ((value: unknown) => unknown)[];
    /** Map of validator key to user-facing error message overrides. */
    errorMessages?: Record<string, string>;
    /**
     * Declares how this field relates to another model: plain FK (`target`), optional explicit
     * many-to-many through model (`through`), and the through-side field names that pair the source
     * and target endpoints.
     */
    references?: {
        /** Symbolic reference to the related model (same resolution rules as elsewhere in schema). */
        target: ModelRef;
        options?: ReferentialOptions;
        /** Explicit join model for a many-to-many when not using an implicit through table. */
        through?: ModelRef;
        /**
         * Schema field key on the through model that holds the foreign key **from** this model’s
         * side of the association.
         */
        throughSourceFieldName?: string;
        /**
         * Schema field key on the through model that holds the foreign key **to** the related
         * model’s side of the association.
         */
        throughTargetFieldName?: string;
    };
    /**
     * Classifies decorated relation endpoints (`foreignKey`, `oneToOne`, `manyToMany`) for
     * normalization and graph construction.
     */
    relationKind?: DecoratedFieldKind;
    /**
     * Preferred name for the forward edge from this model toward {@link references.target}
     * (overrides inferred naming).
     */
    forwardName?: string;
    /**
     * Preferred name for the reverse edge back from the related model (overrides inferred naming).
     */
    reverseName?: string;
}
