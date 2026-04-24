import type { RelationHydrationLoadMode } from './RelationMeta';
import type { RelationHydrationCardinality } from './RelationTyping';
import { InternalPrefetchQueryKind } from './internal/InternalPrefetchQueryKind';

/**
 * Result of compiling a {@link QuerySet} into an executable SQL statement plus
 * the hydration plan the executor needs to reshape flat rows into nested
 * relation graphs.
 */
export interface CompiledQuery {
    /**
     * Parameterized SQL string ready for `client.query(...)`. Identifiers and
     * relation names are pre-validated; values never appear inline.
     */
    sql: string;

    /**
     * Parameter values bound to the SQL statement in the same order the
     * placeholders appear.
     */
    params: readonly unknown[];

    /**
     * Optional hydration plan produced when the query declared selected or
     * prefetched relations. Absent for plain row reads that do no
     * relation-shaping work.
     */
    hydrationPlan?: CompiledHydrationPlanRoot;
}

/**
 * Top-level hydration plan for a compiled query. Groups the join-time
 * hydration nodes (emitted inline with the root query) with the prefetch
 * hydration nodes (executed as follow-up queries after the root rows land).
 */
export interface CompiledHydrationPlanRoot {
    /**
     * The relation paths the caller originally requested via
     * `selectRelated(...)` / `prefetchRelated(...)`. Retained for diagnostic
     * messages and snapshot stability.
     */
    requestedPaths: readonly string[];

    /**
     * Column aliases on the root query that exist solely to support hydration
     * (for example, join-mirrored primary keys). The hydrator strips these
     * before handing rows back to application code.
     */
    hiddenRootAliases: readonly string[];

    /**
     * Hydration nodes whose rows arrive joined into the root query's result
     * set. Each node describes how to fold those joined columns back into a
     * nested relation attribute.
     */
    joinNodes: readonly CompiledHydrationNode[];

    /**
     * Hydration nodes that require a follow-up prefetch query after the root
     * rows land. Each node drives one or more `compilePrefetch(...)` calls.
     */
    prefetchNodes: readonly CompiledHydrationNode[];
}

/**
 * Recursive description of how to hydrate one relation edge and its
 * descendants. The same node shape is used for join-loaded and
 * prefetch-loaded relations; {@link loadMode} distinguishes them.
 */
export interface CompiledHydrationNode {
    /** Stable identifier for this node in the plan. */
    nodeId: string;

    /**
     * Public relation name as declared in the schema, mirrored onto the
     * hydrated record (for example, `author` or `tags`).
     */
    relationName: string;

    /**
     * Dot-less path expression that reaches this node from the root, used in
     * error messages and plan diagnostics.
     */
    relationPath: string;

    /** Model key of the owner side of this edge. */
    ownerModelKey: string;

    /** Model key of the target side of this edge. */
    targetModelKey: string;

    /** Join-inline vs follow-up prefetch load strategy. */
    loadMode: RelationHydrationLoadMode;

    /** Whether this edge yields one target or many. */
    cardinality: RelationHydrationCardinality;

    /**
     * Owner-side column whose value scopes the hydration read. For
     * foreign-key relations this is the local column; for many-to-many this
     * is the owner primary key.
     */
    sourceKey: string;

    /**
     * Column alias on the root SQL row that surfaces `sourceKey` to the
     * hydrator after projection.
     */
    ownerSourceAccessor: string;

    /**
     * Target-side column that matches `sourceKey` during resolution.
     */
    targetKey: string;

    /** Target table name for the related rows. */
    targetTable: string;

    /** Primary-key column name on the target table. */
    targetPrimaryKey: string;

    /** Join table name for many-to-many edges. */
    throughTable?: string;

    /**
     * Join-table column storing the owner-side primary key for many-to-many
     * edges.
     */
    throughSourceKey?: string;

    /**
     * Join-table column storing the target-side primary key for many-to-many
     * edges.
     */
    throughTargetKey?: string;

    /**
     * SQL type of the owner-side join column, used to validate compiled
     * placeholder values.
     */
    throughSourceColumnType?: string;

    /**
     * SQL type of the target-side join column, used to validate compiled
     * placeholder values.
     */
    throughTargetColumnType?: string;

    /**
     * Column map for the target table keyed by column name. Used by the
     * hydrator to materialize target rows and by the compiler to emit a
     * stable projection.
     */
    targetColumns: Record<string, string>;

    /**
     * Ordered trail of relation names that led to this node. Used to produce
     * precise error messages when a hydration plan fails to compile.
     */
    provenance: readonly string[];

    /** Child nodes whose rows arrive joined with this node's rows. */
    joinChildren: readonly CompiledHydrationNode[];

    /** Child nodes that require their own follow-up prefetch. */
    prefetchChildren: readonly CompiledHydrationNode[];

    /** SQL join descriptor attached when this node is loaded inline. */
    join?: CompiledJoinHydrationDescriptor;
}

/**
 * Join-specific details for a hydration node loaded inline with its parent
 * query. Captures the alias the compiler emitted for the joined table and
 * the column aliases under which each projected column appears in the result
 * row.
 */
export interface CompiledJoinHydrationDescriptor {
    /** SQL alias emitted for the joined table. */
    alias: string;

    /**
     * Aliases for each projected target column, keyed by column name.
     * Ensures the hydrator can pull the column out of the flat SQL row.
     */
    columns: Record<string, string>;
}

/**
 * Discriminated union describing a prefetch query that must run after the
 * root rows load. `direct` is a one-shot select against the target table;
 * `manyToMany` is a two-phase plan that first reads join rows, then loads
 * the target rows by primary key.
 */
export type CompiledPrefetchQuery =
    | {
          /** Marks a single-query prefetch against the target table. */
          kind: typeof InternalPrefetchQueryKind.DIRECT;

          /** Parameterized select statement to execute. */
          sql: string;

          /** Parameter values bound to the statement. */
          params: readonly unknown[];

          /**
           * Target column whose value matches the owner-side `sourceKey`. The
           * hydrator buckets the returned rows by this column.
           */
          targetKey: string;

          /** Column map for the target rows the hydrator will materialize. */
          targetColumns: Record<string, string>;
      }
    | {
          /**
           * Marks a two-phase many-to-many prefetch: the join-row query runs
           * first, then a follow-up target query resolves the actual rows by
           * primary key.
           */
          kind: typeof InternalPrefetchQueryKind.MANY_TO_MANY;

          /**
           * SQL for the first phase: select owner/target id pairs from the
           * join table.
           */
          throughSql: string;

          /** Parameter values bound to the join-row statement. */
          throughParams: readonly unknown[];

          /**
           * Alias the compiler assigned to the owner-side join column in the
           * join-row result set. The hydrator uses it to group targets by
           * owner.
           */
          ownerAlias: string;

          /**
           * Alias the compiler assigned to the target-side join column in
           * the join-row result set. The hydrator uses it to assemble the
           * target primary-key list for phase two.
           */
          targetAlias: string;

          /** Target table name for the phase-two read. */
          targetTable: string;

          /** Primary-key column on the target table for the phase-two read. */
          targetPrimaryKey: string;

          /** Column map for the target rows the hydrator will materialize. */
          targetColumns: Record<string, string>;
      };
