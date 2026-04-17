import { isError } from '@danceroutine/tango-core';
import type { LookupType } from '../domain/LookupType';
import type { QuerySetState } from '../domain/QuerySetState';
import type { TableMeta } from '../domain/TableMeta';
import type { QNode } from '../domain/QNode';
import type {
    CompiledHydrationNode,
    CompiledHydrationPlanRoot,
    CompiledJoinHydrationDescriptor,
    CompiledPrefetchQuery,
    CompiledQuery,
} from '../domain/CompiledQuery';
import type { WhereClause } from '../domain/WhereClause';
import type { FilterInput } from '../domain/FilterInput';
import type { Dialect } from '../domain/Dialect';
import { InternalRelationHydrationLoadMode } from '../domain/RelationMeta';
import { InternalDialect } from '../domain/internal/InternalDialect';
import { InternalQNodeType } from '../domain/internal/InternalQNodeType';
import { InternalLookupType } from '../domain/internal/InternalLookupType';
import { OrmSqlSafetyAdapter } from '../../validation';
import { QueryPlanner } from '../planning';
import type { QueryHydrationPlanNode } from '../planning';

const sqlSafetyAdapter = new OrmSqlSafetyAdapter();

type JoinCollection = {
    selects: string[];
    joins: string[];
};

/**
 * Compiles immutable `QuerySet` state into parameterized SQL and recursive
 * hydration execution artifacts.
 */
export class QueryCompiler {
    static readonly BRAND = 'tango.orm.query_compiler' as const;
    readonly __tangoBrand: typeof QueryCompiler.BRAND = QueryCompiler.BRAND;

    constructor(
        private meta: TableMeta,
        private dialect: Dialect = InternalDialect.POSTGRES
    ) {}

    static isQueryCompiler(value: unknown): value is QueryCompiler {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === QueryCompiler.BRAND
        );
    }

    compile<T>(state: QuerySetState<T>): CompiledQuery {
        const hydrationPlan = new QueryPlanner(this.meta).plan(state);
        const validatedPlan = sqlSafetyAdapter.validate({
            kind: 'select',
            meta: this.meta,
            selectFields: state.select?.map(String),
            filterKeys: this.collectStateFilterKeys(state),
            orderFields: state.order?.map((order) => String(order.by)),
            relationNames: [],
        });
        const table = validatedPlan.meta.table;
        const whereParts: string[] = [];
        const params: unknown[] = [];

        if (state.q) {
            const result = this.compileQNode(state.q, params.length + 1, validatedPlan.filterKeys);
            if (result.sql) {
                whereParts.push(result.sql);
                params.push(...result.params);
            }
        }

        state.excludes?.forEach((exclude) => {
            const result = this.compileQNode(
                { kind: InternalQNodeType.NOT, node: exclude },
                params.length + 1,
                validatedPlan.filterKeys
            );
            if (result.sql) {
                whereParts.push(result.sql);
                params.push(...result.params);
            }
        });

        const baseSelects = state.select?.length
            ? state.select.map((field) => validatedPlan.selectFields[String(field)]!)
            : [`${table}.*`];
        const joinCollection: JoinCollection = { selects: [], joins: [] };
        const hiddenRootAliases: string[] = [];

        const compiledJoinNodes = hydrationPlan.joinNodes.map((node) =>
            this.compileHydrationNode(node, {
                rootTable: table,
                ownerMeta: this.meta,
                ownerAlias: table,
                collectRootJoins: true,
                rootSelectedFields: state.select?.map(String) ?? undefined,
                hiddenRootAliases,
                joinCollection,
            })
        );
        const compiledPrefetchNodes = hydrationPlan.prefetchNodes.map((node) =>
            this.compileHydrationNode(node, {
                rootTable: table,
                ownerMeta: this.meta,
                ownerAlias: table,
                collectRootJoins: false,
                rootSelectedFields: state.select?.map(String) ?? undefined,
                hiddenRootAliases,
                joinCollection,
            })
        );

        const select = [
            ...baseSelects,
            ...joinCollection.selects,
            ...this.buildRootHiddenSelects(compiledPrefetchNodes, table),
        ].join(', ');
        const whereSQL = whereParts.length ? ` WHERE ${whereParts.join(' AND ')}` : '';
        const orderSQL = ` ORDER BY ${
            state.order?.length
                ? state.order
                      .map((order) => `${validatedPlan.orderFields[String(order.by)]!} ${order.dir.toUpperCase()}`)
                      .join(', ')
                : `${table}.${validatedPlan.meta.pk} ASC`
        }`;
        const limitSQL = state.limit ? ` LIMIT ${state.limit}` : '';
        const offsetSQL = state.offset ? ` OFFSET ${state.offset}` : '';
        const sql = `SELECT ${select} FROM ${table}${joinCollection.joins.length ? ` ${joinCollection.joins.join(' ')}` : ''}${whereSQL}${orderSQL}${limitSQL}${offsetSQL}`;

        const compiledHydrationPlan: CompiledHydrationPlanRoot | undefined =
            compiledJoinNodes.length > 0 || compiledPrefetchNodes.length > 0
                ? {
                      requestedPaths: hydrationPlan.requestedPaths,
                      hiddenRootAliases: [...new Set(hiddenRootAliases)],
                      joinNodes: compiledJoinNodes,
                      prefetchNodes: compiledPrefetchNodes,
                  }
                : undefined;

        return {
            sql,
            params,
            hydrationPlan: compiledHydrationPlan,
        };
    }

    compilePrefetch(node: CompiledHydrationNode, sourceValues: readonly (string | number)[]): CompiledPrefetchQuery {
        const placeholders =
            this.dialect === InternalDialect.POSTGRES
                ? sourceValues.map((_, index) => `$${index + 1}`).join(', ')
                : sourceValues.map(() => '?').join(', ');
        const validatedTarget = this.validatePrefetchTarget(node);
        const baseAlias = this.buildPrefetchBaseAlias(node.relationPath);
        const joinCollection: JoinCollection = { selects: [], joins: [] };

        for (const joinChild of node.joinChildren) {
            this.collectNestedJoinSql(joinChild, baseAlias, validatedTarget.columns, joinCollection);
        }

        const baseSelects = Object.keys(validatedTarget.columns).map((column) => `${baseAlias}.${column} AS ${column}`);
        return {
            sql: `SELECT ${[...baseSelects, ...joinCollection.selects].join(', ')} FROM ${validatedTarget.table} ${baseAlias}${joinCollection.joins.length ? ` ${joinCollection.joins.join(' ')}` : ''} WHERE ${baseAlias}.${validatedTarget.targetKey} IN (${placeholders}) ORDER BY ${baseAlias}.${validatedTarget.targetKey} ASC, ${baseAlias}.${validatedTarget.primaryKey} ASC`,
            params: sourceValues,
            targetKey: validatedTarget.targetKey,
            targetColumns: validatedTarget.columns,
        };
    }

    private compileHydrationNode(
        node: QueryHydrationPlanNode,
        context: {
            rootTable: string;
            ownerMeta: TableMeta;
            ownerAlias: string;
            collectRootJoins: boolean;
            rootSelectedFields?: readonly string[];
            hiddenRootAliases: string[];
            joinCollection: JoinCollection;
        }
    ): CompiledHydrationNode {
        const validatedRelation = this.validateHydrationRelation(context.ownerMeta, node.relationName);
        const targetColumns = validatedRelation.targetColumns;
        const targetMeta = node.relationEdge.targetMeta;
        if (!targetMeta) {
            throw new Error(`Relation path '${node.relationPath}' is missing target metadata.`);
        }
        const compiledJoinChildren = node.joinChildren.map((child) =>
            this.compileHydrationNode(child, {
                ...context,
                ownerMeta: targetMeta,
                ownerAlias: this.buildJoinAlias(node.relationPath),
                collectRootJoins: context.collectRootJoins,
            })
        );
        const compiledPrefetchChildren = node.prefetchChildren.map((child) =>
            this.compileHydrationNode(child, {
                ...context,
                ownerMeta: targetMeta,
                ownerAlias: this.buildJoinAlias(node.relationPath),
                collectRootJoins: false,
            })
        );

        let joinDescriptor: CompiledJoinHydrationDescriptor | undefined;
        if (node.loadMode === InternalRelationHydrationLoadMode.JOIN) {
            joinDescriptor = {
                alias: this.buildJoinAlias(node.relationPath),
                columns: Object.fromEntries(
                    Object.keys(targetColumns).map((column) => [
                        column,
                        this.buildHydrationColumnAlias(node.relationPath, column),
                    ])
                ),
            };

            if (context.collectRootJoins) {
                context.joinCollection.joins.push(
                    `LEFT JOIN ${validatedRelation.table} ${joinDescriptor.alias} ON ${joinDescriptor.alias}.${validatedRelation.targetKey} = ${context.ownerAlias}.${validatedRelation.sourceKey}`
                );
                context.joinCollection.selects.push(
                    ...Object.entries(joinDescriptor.columns).map(
                        ([column, alias]) => `${joinDescriptor!.alias}.${column} AS ${alias}`
                    )
                );
            }
        }

        const ownerSourceAccessor =
            node.loadMode === InternalRelationHydrationLoadMode.PREFETCH &&
            context.collectRootJoins === false &&
            context.ownerAlias === context.rootTable &&
            context.rootSelectedFields?.length &&
            !context.rootSelectedFields.includes(validatedRelation.sourceKey)
                ? this.buildPrefetchSourceAlias(node.relationPath, validatedRelation.sourceKey)
                : validatedRelation.sourceKey;

        if (
            node.loadMode === InternalRelationHydrationLoadMode.PREFETCH &&
            ownerSourceAccessor !== validatedRelation.sourceKey
        ) {
            context.hiddenRootAliases.push(ownerSourceAccessor);
        }

        return {
            nodeId: node.nodeId,
            relationName: node.relationName,
            relationPath: node.relationPath,
            ownerModelKey: node.ownerModelKey,
            targetModelKey: node.targetModelKey,
            loadMode: node.loadMode,
            cardinality: node.cardinality,
            sourceKey: validatedRelation.sourceKey,
            ownerSourceAccessor,
            targetKey: validatedRelation.targetKey,
            targetTable: validatedRelation.table,
            targetPrimaryKey: node.relationEdge.targetPrimaryKey,
            targetColumns,
            provenance: node.provenance,
            joinChildren: compiledJoinChildren,
            prefetchChildren: compiledPrefetchChildren,
            join: joinDescriptor,
        };
    }

    private validateHydrationRelation(
        ownerMeta: TableMeta,
        relationName: string
    ): NonNullable<TableMeta['relations']>[string] {
        return sqlSafetyAdapter.validate({
            kind: 'select',
            meta: ownerMeta,
            relationNames: [relationName],
        }).relations[relationName]!;
    }

    private buildRootHiddenSelects(nodes: readonly CompiledHydrationNode[], table: string): string[] {
        return nodes.flatMap((node) => {
            const select =
                node.ownerSourceAccessor !== node.sourceKey
                    ? [`${table}.${node.sourceKey} AS ${node.ownerSourceAccessor}`]
                    : [];
            return [...select, ...this.buildRootHiddenSelects(node.prefetchChildren, table)];
        });
    }

    private validatePrefetchTarget(node: CompiledHydrationNode): {
        table: string;
        primaryKey: string;
        targetKey: string;
        columns: Record<string, string>;
    } {
        try {
            const validated = sqlSafetyAdapter.validate({
                kind: 'select',
                meta: {
                    table: node.targetTable,
                    pk: node.targetPrimaryKey,
                    columns: node.targetColumns,
                },
                filterKeys: [node.targetKey],
            });

            return {
                table: validated.meta.table,
                primaryKey: validated.meta.pk,
                targetKey: validated.filterKeys[node.targetKey]!.field,
                columns: validated.meta.columns,
            };
        } catch (error) {
            const message = isError(error) ? error.message : String(error);
            throw new Error(`Compiled prefetch query failed validation: ${message}`, { cause: error });
        }
    }

    private collectNestedJoinSql(
        node: CompiledHydrationNode,
        ownerAlias: string,
        ownerColumns: Record<string, string>,
        collection: JoinCollection
    ): void {
        if (!node.join) {
            return;
        }

        const validatedTarget = this.validatePrefetchJoinTarget(node, ownerColumns);
        const validatedJoinAlias = this.validateInternalAlias(node.join.alias);
        const validatedJoinColumns = Object.fromEntries(
            Object.entries(node.join.columns).map(([column, alias]) => {
                if (!(column in validatedTarget.columns)) {
                    throw new Error(
                        `Compiled prefetch query failed validation: unknown nested join column '${column}'.`
                    );
                }
                return [column, this.validateInternalAlias(alias)];
            })
        );

        collection.joins.push(
            `LEFT JOIN ${validatedTarget.table} ${validatedJoinAlias} ON ${validatedJoinAlias}.${validatedTarget.targetKey} = ${ownerAlias}.${node.sourceKey}`
        );
        collection.selects.push(
            ...Object.entries(validatedJoinColumns).map(
                ([column, alias]) => `${validatedJoinAlias}.${column} AS ${alias}`
            )
        );

        for (const child of node.joinChildren) {
            this.collectNestedJoinSql(child, validatedJoinAlias, validatedTarget.columns, collection);
        }
    }

    private validatePrefetchJoinTarget(
        node: CompiledHydrationNode,
        ownerColumns: Record<string, string>
    ): {
        table: string;
        primaryKey: string;
        targetKey: string;
        columns: Record<string, string>;
    } {
        if (!(node.sourceKey in ownerColumns)) {
            throw new Error(
                `Compiled prefetch query failed validation: unknown owner column '${node.sourceKey}' for nested join.`
            );
        }

        return this.validatePrefetchTarget(node);
    }

    private validateInternalAlias(alias: string): string {
        if (!/^__tango_[A-Za-z0-9_]+$/.test(alias)) {
            throw new Error(`Compiled prefetch query failed validation: invalid internal alias '${alias}'.`);
        }

        return alias;
    }

    private buildJoinAlias(relationPath: string): string {
        return this.assertInternalAliasDoesNotCollide(`__tango_join_${this.sanitizeRelationPath(relationPath)}`);
    }

    private buildPrefetchBaseAlias(relationPath: string): string {
        return this.assertInternalAliasDoesNotCollide(
            `__tango_prefetch_base_${this.sanitizeRelationPath(relationPath)}`
        );
    }

    private buildHydrationColumnAlias(relationPath: string, column: string): string {
        return this.assertInternalAliasDoesNotCollide(
            `__tango_hydrate_${this.sanitizeRelationPath(relationPath)}_${column}`
        );
    }

    private buildPrefetchSourceAlias(relationPath: string, sourceKey: string): string {
        return this.assertInternalAliasDoesNotCollide(
            `__tango_prefetch_${this.sanitizeRelationPath(relationPath)}_${sourceKey}`
        );
    }

    private sanitizeRelationPath(relationPath: string): string {
        return relationPath.replace(/[^a-zA-Z0-9]+/g, '_');
    }

    private assertInternalAliasDoesNotCollide(alias: string): string {
        if (alias in this.meta.columns) {
            throw new Error(`Internal query alias '${alias}' collides with a field on table '${this.meta.table}'.`);
        }
        return alias;
    }

    private compileQNode<T>(
        node: QNode<T>,
        paramIndex: number,
        filterKeys: Record<string, { lookup: LookupType; qualifiedColumn: string }>
    ): WhereClause {
        switch (node.kind) {
            case InternalQNodeType.ATOM:
                return this.compileAtom(node.where || {}, paramIndex, filterKeys);
            case InternalQNodeType.AND:
                return this.compileAnd(node.nodes || [], paramIndex, filterKeys);
            case InternalQNodeType.OR:
                return this.compileOr(node.nodes || [], paramIndex, filterKeys);
            case InternalQNodeType.NOT:
                return this.compileNot(node.node!, paramIndex, filterKeys);
            default:
                return { sql: '', params: [] };
        }
    }

    private compileAtom<T>(
        where: FilterInput<T>,
        paramIndex: number,
        filterKeys: Record<string, { lookup: LookupType; qualifiedColumn: string }>
    ): WhereClause {
        const entries = Object.entries(where).filter(([, value]) => value !== undefined);

        const { parts, params } = entries.reduce<{ parts: string[]; params: unknown[] }>(
            (accumulator, [key, value]) => {
                const descriptor = filterKeys[String(key)]!;
                const idx = paramIndex + accumulator.params.length;
                const clause = this.lookupToSQL(descriptor.qualifiedColumn, descriptor.lookup, value, idx);
                accumulator.parts.push(clause.sql);
                accumulator.params.push(...clause.params);
                return accumulator;
            },
            { parts: [], params: [] }
        );

        return {
            sql: parts.length ? `(${parts.join(' AND ')})` : '',
            params,
        };
    }

    private compileAnd<T>(
        nodes: QNode<T>[],
        paramIndex: number,
        filterKeys: Record<string, { lookup: LookupType; qualifiedColumn: string }>
    ): WhereClause {
        const { parts, params } = nodes.reduce<{ parts: string[]; params: unknown[] }>(
            (accumulator, node) => {
                const result = this.compileQNode(node, paramIndex + accumulator.params.length, filterKeys);
                if (result.sql) {
                    accumulator.parts.push(result.sql);
                    accumulator.params.push(...result.params);
                }
                return accumulator;
            },
            { parts: [], params: [] }
        );

        return {
            sql: parts.length ? `(${parts.join(' AND ')})` : '',
            params,
        };
    }

    private compileOr<T>(
        nodes: QNode<T>[],
        paramIndex: number,
        filterKeys: Record<string, { lookup: LookupType; qualifiedColumn: string }>
    ): WhereClause {
        const { parts, params } = nodes.reduce<{ parts: string[]; params: unknown[] }>(
            (accumulator, node) => {
                const result = this.compileQNode(node, paramIndex + accumulator.params.length, filterKeys);
                if (result.sql) {
                    accumulator.parts.push(result.sql);
                    accumulator.params.push(...result.params);
                }
                return accumulator;
            },
            { parts: [], params: [] }
        );

        return {
            sql: parts.length ? `(${parts.join(' OR ')})` : '',
            params,
        };
    }

    private compileNot<T>(
        node: QNode<T>,
        paramIndex: number,
        filterKeys: Record<string, { lookup: LookupType; qualifiedColumn: string }>
    ): WhereClause {
        const result = this.compileQNode(node, paramIndex, filterKeys);
        if (!result.sql) {
            return { sql: '', params: [] };
        }

        return {
            sql: `(NOT ${result.sql})`,
            params: result.params,
        };
    }

    private lookupToSQL(col: string, lookup: LookupType, value: unknown, paramIndex: number): WhereClause {
        const placeholder = this.dialect === InternalDialect.POSTGRES ? `$${paramIndex}` : '?';
        const normalized = this.normalizeParam(value);

        switch (lookup) {
            case InternalLookupType.EXACT:
                if (value === null) {
                    return { sql: `${col} IS NULL`, params: [] };
                }
                return { sql: `${col} = ${placeholder}`, params: [normalized] };
            case InternalLookupType.LT:
                return { sql: `${col} < ${placeholder}`, params: [normalized] };
            case InternalLookupType.LTE:
                return { sql: `${col} <= ${placeholder}`, params: [normalized] };
            case InternalLookupType.GT:
                return { sql: `${col} > ${placeholder}`, params: [normalized] };
            case InternalLookupType.GTE:
                return { sql: `${col} >= ${placeholder}`, params: [normalized] };
            case InternalLookupType.IN: {
                const entries = (Array.isArray(value) ? value : [value]).map((entry) => this.normalizeParam(entry));
                if (entries.length === 0) {
                    return { sql: '1=0', params: [] };
                }
                const placeholders =
                    this.dialect === InternalDialect.POSTGRES
                        ? entries.map((_, index) => `$${paramIndex + index}`).join(', ')
                        : entries.map(() => '?').join(', ');
                return { sql: `${col} IN (${placeholders})`, params: entries };
            }
            case InternalLookupType.ISNULL:
                return { sql: value ? `${col} IS NULL` : `${col} IS NOT NULL`, params: [] };
            case InternalLookupType.CONTAINS:
                return { sql: `${col} LIKE ${placeholder}`, params: [`%${value}%`] };
            case InternalLookupType.ICONTAINS: {
                const lowerCol = this.dialect === InternalDialect.POSTGRES ? `LOWER(${col})` : `${col}`;
                return { sql: `${lowerCol} LIKE ${placeholder}`, params: [`%${String(value).toLowerCase()}%`] };
            }
            case InternalLookupType.STARTSWITH:
                return { sql: `${col} LIKE ${placeholder}`, params: [`${value}%`] };
            case InternalLookupType.ISTARTSWITH: {
                const lowerCol = this.dialect === InternalDialect.POSTGRES ? `LOWER(${col})` : `${col}`;
                return { sql: `${lowerCol} LIKE ${placeholder}`, params: [`${String(value).toLowerCase()}%`] };
            }
            case InternalLookupType.ENDSWITH:
                return { sql: `${col} LIKE ${placeholder}`, params: [`%${value}`] };
            case InternalLookupType.IENDSWITH: {
                const lowerCol = this.dialect === InternalDialect.POSTGRES ? `LOWER(${col})` : `${col}`;
                return { sql: `${lowerCol} LIKE ${placeholder}`, params: [`%${String(value).toLowerCase()}`] };
            }
            default:
                throw new Error(`Unknown lookup: ${lookup}`);
        }
    }

    private normalizeParam(value: unknown): unknown {
        if (this.dialect === InternalDialect.SQLITE && typeof value === 'boolean') {
            return value ? 1 : 0;
        }
        return value;
    }

    private collectStateFilterKeys<T>(state: QuerySetState<T>): string[] {
        const filterKeys = new Set<string>();
        if (state.q) {
            this.collectNodeFilterKeys(state.q, filterKeys);
        }

        state.excludes?.forEach((exclude) => this.collectNodeFilterKeys(exclude, filterKeys));
        return [...filterKeys];
    }

    private collectNodeFilterKeys<T>(node: QNode<T>, filterKeys: Set<string>): void {
        Object.keys(node.where ?? {}).forEach((key) => filterKeys.add(key));
        node.nodes?.forEach((child) => this.collectNodeFilterKeys(child, filterKeys));
        if (node.node) {
            this.collectNodeFilterKeys(node.node, filterKeys);
        }
    }
}
