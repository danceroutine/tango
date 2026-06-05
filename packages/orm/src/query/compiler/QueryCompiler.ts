import type { QuerySetState } from '../domain/QuerySetState';
import type { TableMeta } from '../domain/TableMeta';
import type { CompiledHydrationNode, CompiledPrefetchQuery, CompiledQuery } from '../domain/CompiledQuery';
import type { Adapter } from '../../connection/adapters/Adapter';
import { InternalDialect } from '../domain/internal/InternalDialect';
import { InternalQNodeType } from '../domain/internal/InternalQNodeType';
import { InternalSqlValidationPlanKind as SqlPlanKind } from '../../validation/internal/InternalSqlValidationPlanKind';
import { OrmSqlSafetyAdapter } from '../../validation';
import type { ValidatedSelectSqlPlan } from '../../validation/SQLValidationEngine';
import { QueryPlanner } from '../planning';
import { HydrationPlanCompiler } from './HydrationPlanCompiler';
import { PrefetchQueryCompiler } from './PrefetchQueryCompiler';
import { WhereCompiler } from './WhereCompiler';

const sqlSafetyAdapter = new OrmSqlSafetyAdapter();

/**
 * Compiles immutable `QuerySet` state into parameterized SQL and recursive
 * hydration execution artifacts.
 */
export class QueryCompiler {
    static readonly BRAND = 'tango.orm.query_compiler' as const;
    readonly __tangoBrand: typeof QueryCompiler.BRAND = QueryCompiler.BRAND;

    private readonly whereCompiler: WhereCompiler;
    private readonly prefetchCompiler: PrefetchQueryCompiler;
    private readonly hydrationCompiler: HydrationPlanCompiler;

    constructor(
        private meta: TableMeta,
        private adapter: Adapter
    ) {
        this.whereCompiler = new WhereCompiler(meta, adapter);
        this.prefetchCompiler = new PrefetchQueryCompiler(meta, adapter);
        this.hydrationCompiler = new HydrationPlanCompiler(meta);
    }

    static isQueryCompiler(value: unknown): value is QueryCompiler {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === QueryCompiler.BRAND
        );
    }

    compile<T, TSourceModel = unknown>(state: QuerySetState<T, TSourceModel>): CompiledQuery {
        const hydrationPlan = new QueryPlanner(this.meta).plan(state);
        const validatedPlan = sqlSafetyAdapter.validate({
            kind: SqlPlanKind.SELECT,
            meta: this.meta,
            selectFields: state.select?.map(String),
            filterKeys: this.whereCompiler.collectStateFilterKeys(state),
            orderFields: state.order?.map((order) => String(order.by)),
            relationNames: [],
        });
        const table = validatedPlan.meta.table;
        const whereParts: string[] = [];
        const params: unknown[] = [];

        if (state.q) {
            const result = this.whereCompiler.compileNode(state.q, params.length + 1, validatedPlan.filterKeys);
            if (result.sql) {
                whereParts.push(result.sql);
                params.push(...result.params);
            }
        }

        state.excludes?.forEach((exclude) => {
            const result = this.whereCompiler.compileNode(
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
        const compiledHydration = this.hydrationCompiler.compile(hydrationPlan, {
            rootTable: table,
            rootSelectedFields: state.select?.map(String) ?? undefined,
        });

        const select = [
            ...baseSelects,
            ...compiledHydration.rootJoinSelects,
            ...compiledHydration.rootHiddenSelects,
        ].join(', ');
        const whereSQL = whereParts.length ? ` WHERE ${whereParts.join(' AND ')}` : '';
        const { orderSQL, limitSQL, offsetSQL } = this.buildQueryWindowSuffix(state, validatedPlan, table);
        const sql = `SELECT ${select} FROM ${table}${compiledHydration.rootJoinSql.length ? ` ${compiledHydration.rootJoinSql.join(' ')}` : ''}${whereSQL}${orderSQL}${limitSQL}${offsetSQL}`;

        const compiledHydrationPlan =
            compiledHydration.joinNodes.length > 0 || compiledHydration.prefetchNodes.length > 0
                ? {
                      requestedPaths: hydrationPlan.requestedPaths,
                      hiddenRootAliases: compiledHydration.hiddenRootAliases,
                      joinNodes: compiledHydration.joinNodes,
                      prefetchNodes: compiledHydration.prefetchNodes,
                  }
                : undefined;

        return {
            sql,
            params,
            hydrationPlan: compiledHydrationPlan,
        };
    }

    compileExists<T, TSourceModel = unknown>(state: QuerySetState<T, TSourceModel>): CompiledQuery {
        const validatedPlan = sqlSafetyAdapter.validate({
            kind: SqlPlanKind.SELECT,
            meta: this.meta,
            selectFields: state.select?.map(String),
            filterKeys: this.whereCompiler.collectStateFilterKeys(state),
            orderFields: state.order?.map((order) => String(order.by)),
            relationNames: [],
        });
        const table = validatedPlan.meta.table;
        const whereParts: string[] = [];
        const params: unknown[] = [];

        if (state.q) {
            const result = this.whereCompiler.compileNode(state.q, params.length + 1, validatedPlan.filterKeys);
            if (result.sql) {
                whereParts.push(result.sql);
                params.push(...result.params);
            }
        }

        state.excludes?.forEach((exclude) => {
            const result = this.whereCompiler.compileNode(
                { kind: InternalQNodeType.NOT, node: exclude },
                params.length + 1,
                validatedPlan.filterKeys
            );
            if (result.sql) {
                whereParts.push(result.sql);
                params.push(...result.params);
            }
        });

        const whereSQL = whereParts.length ? ` WHERE ${whereParts.join(' AND ')}` : '';
        if (state.limit === undefined && state.offset === undefined) {
            return {
                sql: `SELECT 1 AS tango_exists FROM ${table}${whereSQL} LIMIT 1`,
                params,
            };
        }

        const { orderSQL, limitSQL, offsetSQL } = this.buildQueryWindowSuffix(state, validatedPlan, table, {
            existsProbe: state.offset !== undefined,
        });
        return {
            sql: `SELECT 1 AS tango_exists FROM ${table}${whereSQL}${orderSQL}${limitSQL}${offsetSQL}`,
            params,
        };
    }

    compilePrefetch(node: CompiledHydrationNode, sourceValues: readonly (string | number)[]): CompiledPrefetchQuery {
        return this.prefetchCompiler.compilePrefetch(node, sourceValues);
    }

    compileManyToManyTargets(
        node: CompiledHydrationNode,
        targetIds: readonly (string | number)[]
    ): { sql: string; params: readonly unknown[] } {
        return this.prefetchCompiler.compileManyToManyTargets(node, targetIds);
    }

    private buildQueryWindowSuffix<T, TSourceModel = unknown>(
        state: Pick<QuerySetState<T, TSourceModel>, 'order' | 'limit' | 'offset'>,
        validatedPlan: ValidatedSelectSqlPlan,
        table: string,
        options?: { existsProbe?: boolean }
    ): { orderSQL: string; limitSQL: string; offsetSQL: string } {
        const orderSQL = ` ORDER BY ${
            state.order?.length
                ? state.order
                      .map((order) => `${validatedPlan.orderFields[String(order.by)]!} ${order.dir.toUpperCase()}`)
                      .join(', ')
                : `${table}.${validatedPlan.meta.pk} ASC`
        }`;
        const hasOffset = state.offset !== undefined;
        let limitSQL: string;
        if (options?.existsProbe) {
            limitSQL = state.limit === 0 ? ' LIMIT 0' : ' LIMIT 1';
        } else if (state.limit === undefined) {
            limitSQL = hasOffset && this.adapter.dialect === InternalDialect.SQLITE ? ' LIMIT -1' : '';
        } else {
            limitSQL = ` LIMIT ${state.limit}`;
        }

        const offsetSQL = hasOffset ? ` OFFSET ${state.offset}` : '';
        return { orderSQL, limitSQL, offsetSQL };
    }
}
