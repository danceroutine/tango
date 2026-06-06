import type { Adapter, SqlPlaceholders } from '../../connection/adapters/Adapter';
import type { LookupType } from '../domain/LookupType';
import type { FilterInput } from '../domain/FilterInput';
import type { QNode } from '../domain/QNode';
import type { QuerySetState } from '../domain/QuerySetState';
import type { TableMeta } from '../domain/TableMeta';
import type { WhereClause } from '../domain/WhereClause';
import { InternalDialect } from '../domain/internal/InternalDialect';
import { InternalLookupType } from '../domain/internal/InternalLookupType';
import { InternalQNodeType } from '../domain/internal/InternalQNodeType';
import { InternalValidatedFilterDescriptorKind } from '../../validation/internal/InternalValidatedFilterDescriptorKind';
import type { ValidatedFilterDescriptor, ValidatedRelationMeta } from '../../validation/SQLValidationEngine';

/**
 * Compiles validated `QNode` predicate trees into parameterized WHERE fragments.
 */
export class WhereCompiler {
    private readonly placeholders: SqlPlaceholders;

    constructor(
        private readonly meta: TableMeta,
        private readonly adapter: Adapter
    ) {
        this.placeholders = adapter.placeholders;
    }

    collectStateFilterKeys<T, TSourceModel = unknown>(state: QuerySetState<T, TSourceModel>): string[] {
        const filterKeys = new Set<string>();
        if (state.q) {
            this.collectNodeFilterKeys(state.q, filterKeys);
        }

        state.excludes?.forEach((exclude) => this.collectNodeFilterKeys(exclude, filterKeys));
        return [...filterKeys];
    }

    compileNode<T>(
        node: QNode<T>,
        paramIndex: number,
        filterKeys: Record<string, ValidatedFilterDescriptor>
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
        filterKeys: Record<string, ValidatedFilterDescriptor>
    ): WhereClause {
        const entries = Object.entries(where).filter(([, value]) => value !== undefined);

        const { parts, params } = entries.reduce<{ parts: string[]; params: unknown[] }>(
            (accumulator, [key, value]) => {
                const descriptor = filterKeys[String(key)]!;
                const idx = paramIndex + accumulator.params.length;
                const clause =
                    descriptor.kind === InternalValidatedFilterDescriptorKind.COLUMN
                        ? this.lookupToSQL(descriptor.qualifiedColumn, descriptor.lookup, value, idx)
                        : this.compileRelationFilter(descriptor, value, idx);
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
        filterKeys: Record<string, ValidatedFilterDescriptor>
    ): WhereClause {
        const { parts, params } = nodes.reduce<{ parts: string[]; params: unknown[] }>(
            (accumulator, node) => {
                const result = this.compileNode(node, paramIndex + accumulator.params.length, filterKeys);
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
        filterKeys: Record<string, ValidatedFilterDescriptor>
    ): WhereClause {
        const { parts, params } = nodes.reduce<{ parts: string[]; params: unknown[] }>(
            (accumulator, node) => {
                const result = this.compileNode(node, paramIndex + accumulator.params.length, filterKeys);
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
        filterKeys: Record<string, ValidatedFilterDescriptor>
    ): WhereClause {
        const result = this.compileNode(node, paramIndex, filterKeys);
        if (!result.sql) {
            return { sql: '', params: [] };
        }

        return {
            sql: `(NOT ${result.sql})`,
            params: result.params,
        };
    }

    private compileRelationFilter(
        descriptor: Extract<ValidatedFilterDescriptor, { kind: typeof InternalValidatedFilterDescriptorKind.RELATION }>,
        value: unknown,
        paramIndex: number
    ): WhereClause {
        return this.buildRelationFilterExists(
            this.meta.table,
            descriptor.relationChain,
            descriptor.terminalColumn,
            descriptor.lookup,
            value,
            paramIndex,
            descriptor.relationPath
        );
    }

    private buildRelationFilterExists(
        ownerAlias: string,
        relationChain: readonly ValidatedRelationMeta[],
        terminalColumn: string,
        lookup: LookupType,
        value: unknown,
        paramIndex: number,
        relationPath: string
    ): WhereClause {
        const [relation, ...rest] = relationChain;
        if (!relation) {
            throw new Error(`Cannot compile empty relation filter path '${relationPath}'.`);
        }

        const targetAlias = this.buildFilterAlias(relationPath, `target_${relation.alias}_${rest.length}`);
        const targetPredicate =
            rest.length === 0
                ? this.lookupToSQL(`${targetAlias}.${terminalColumn}`, lookup, value, paramIndex)
                : this.buildRelationFilterExists(
                      targetAlias,
                      rest,
                      terminalColumn,
                      lookup,
                      value,
                      paramIndex,
                      relationPath
                  );

        if (relation.throughTable && relation.throughSourceKey && relation.throughTargetKey) {
            const throughAlias = this.buildFilterAlias(relationPath, `through_${relation.alias}_${rest.length}`);
            return {
                sql: `EXISTS (SELECT 1 FROM ${relation.throughTable} ${throughAlias} INNER JOIN ${relation.table} ${targetAlias} ON ${targetAlias}.${relation.targetKey} = ${throughAlias}.${relation.throughTargetKey} WHERE ${throughAlias}.${relation.throughSourceKey} = ${ownerAlias}.${relation.sourceKey} AND ${targetPredicate.sql})`,
                params: targetPredicate.params,
            };
        }

        return {
            sql: `EXISTS (SELECT 1 FROM ${relation.table} ${targetAlias} WHERE ${targetAlias}.${relation.targetKey} = ${ownerAlias}.${relation.sourceKey} AND ${targetPredicate.sql})`,
            params: targetPredicate.params,
        };
    }

    private lookupToSQL(col: string, lookup: LookupType, value: unknown, paramIndex: number): WhereClause {
        const placeholder = this.placeholders.at(paramIndex);
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
                const placeholders = this.placeholders.listFromOffset(entries.length, paramIndex - 1);
                return { sql: `${col} IN (${placeholders})`, params: entries };
            }
            case InternalLookupType.ISNULL:
                return { sql: value ? `${col} IS NULL` : `${col} IS NOT NULL`, params: [] };
            case InternalLookupType.CONTAINS:
                return { sql: `${col} LIKE ${placeholder}`, params: [`%${value}%`] };
            case InternalLookupType.ICONTAINS: {
                const lowerCol = this.adapter.dialect === InternalDialect.POSTGRES ? `LOWER(${col})` : `${col}`;
                return { sql: `${lowerCol} LIKE ${placeholder}`, params: [`%${String(value).toLowerCase()}%`] };
            }
            case InternalLookupType.STARTSWITH:
                return { sql: `${col} LIKE ${placeholder}`, params: [`${value}%`] };
            case InternalLookupType.ISTARTSWITH: {
                const lowerCol = this.adapter.dialect === InternalDialect.POSTGRES ? `LOWER(${col})` : `${col}`;
                return { sql: `${lowerCol} LIKE ${placeholder}`, params: [`${String(value).toLowerCase()}%`] };
            }
            case InternalLookupType.ENDSWITH:
                return { sql: `${col} LIKE ${placeholder}`, params: [`%${value}`] };
            case InternalLookupType.IENDSWITH: {
                const lowerCol = this.adapter.dialect === InternalDialect.POSTGRES ? `LOWER(${col})` : `${col}`;
                return { sql: `${lowerCol} LIKE ${placeholder}`, params: [`%${String(value).toLowerCase()}`] };
            }
            default:
                throw new Error(`Unknown lookup: ${lookup}`);
        }
    }

    private normalizeParam(value: unknown): unknown {
        if (this.adapter.dialect === InternalDialect.SQLITE && typeof value === 'boolean') {
            return value ? 1 : 0;
        }
        return value;
    }

    private buildFilterAlias(relationPath: string, suffix: string): string {
        return this.assertInternalAliasDoesNotCollide(
            `__tango_filter_${this.sanitizeRelationPath(relationPath)}_${suffix}`
        );
    }

    private sanitizeRelationPath(relationPath: string): string {
        return relationPath.replace(/[^a-zA-Z0-9]+/gu, '_');
    }

    private assertInternalAliasDoesNotCollide(alias: string): string {
        if (alias in this.meta.columns) {
            throw new Error(`Internal query alias '${alias}' collides with a field on table '${this.meta.table}'.`);
        }
        return alias;
    }

    private collectNodeFilterKeys<T, TSourceModel = unknown>(
        node: QNode<T, TSourceModel>,
        filterKeys: Set<string>
    ): void {
        Object.keys(node.where ?? {}).forEach((key) => filterKeys.add(key));
        node.nodes?.forEach((child) => this.collectNodeFilterKeys(child, filterKeys));
        if (node.node) {
            this.collectNodeFilterKeys(node.node, filterKeys);
        }
    }
}
