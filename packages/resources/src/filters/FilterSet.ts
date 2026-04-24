import { TangoQueryParams } from '@danceroutine/tango-core';
import type { FilterInput, FilterKey, FilterValue, LookupType } from '@danceroutine/tango-orm';
import { InternalFilterType } from './internal/InternalFilterType';
import { InternalFilterLookup } from './internal/InternalFilterLookup';
import type { RangeOperator } from './RangeOperator';

const FILTER_LOOKUPS = Object.values(InternalFilterLookup) as readonly LookupType[];

type FilterFieldRef<T extends Record<string, unknown>> = Extract<keyof T, string> | string;

function isFilterLookup(value: string): value is LookupType {
    return (FILTER_LOOKUPS as readonly string[]).includes(value);
}

/**
 * Configuration for how a query parameter should be resolved into a filter.
 * Supports scalar equality, case-insensitive search, range comparisons, IN queries, and custom logic.
 */
export type FilterResolver<T extends Record<string, unknown>> =
    | { type: typeof InternalFilterType.SCALAR; column: FilterFieldRef<T> }
    | { type: typeof InternalFilterType.ILIKE; columns: FilterFieldRef<T>[] }
    | { type: typeof InternalFilterType.RANGE; column: FilterFieldRef<T>; op: RangeOperator }
    | { type: typeof InternalFilterType.IN; column: FilterFieldRef<T> }
    | {
          type: typeof InternalFilterType.CUSTOM;
          apply: (value: string | string[] | undefined) => FilterInput<T> | undefined;
      };

export type FilterLookup = LookupType;

export type FilterValueParser = (raw: string | string[]) => FilterValue | FilterValue[] | undefined;

export type FieldFilterDeclaration =
    | true
    | readonly FilterLookup[]
    | {
          lookups?: readonly FilterLookup[];
          param?: string;
          parse?: FilterValueParser;
      };

export type AliasFilterDeclaration<T extends Record<string, unknown>> =
    | FilterResolver<T>
    | {
          field: FilterFieldRef<T>;
          lookup?: FilterLookup;
          parse?: FilterValueParser;
      }
    | {
          fields: readonly FilterFieldRef<T>[];
          lookup?: FilterLookup;
          parse?: FilterValueParser;
      };

export interface FilterSetDefineConfig<T extends Record<string, unknown>> {
    fields?: Partial<Record<string, FieldFilterDeclaration>>;
    aliases?: Record<string, AliasFilterDeclaration<T>>;
    parsers?: Partial<Record<string, FilterValueParser>>;
    all?: '__all__';
}

type ResolvedFilterValue = string | string[] | FilterValue | FilterValue[];

/**
 * Declarative query-param to filter translation.
 *
 * A `FilterSet` lets viewsets expose safe, explicit filtering behavior
 * without leaking raw ORM filter syntax to request handlers.
 */
export class FilterSet<T extends Record<string, unknown>> {
    static readonly BRAND = 'tango.resources.filter_set' as const;
    readonly __tangoBrand: typeof FilterSet.BRAND = FilterSet.BRAND;

    /**
     * Resolve matching query parameters into ORM filter inputs.
     */
    constructor(
        private readonly spec: Record<string, FilterResolver<T>>,
        private readonly allowAllParams: boolean = false
    ) {}

    /**
     * Build a filter set from Django-style field declarations.
     */
    static define<T extends Record<string, unknown>>(config: FilterSetDefineConfig<T>): FilterSet<T> {
        const spec = FilterSet.normalizeDefineConfig(config);
        return new FilterSet(spec, config.all === '__all__');
    }

    /**
     * Narrow an unknown value to `FilterSet`.
     */
    static isFilterSet<T extends Record<string, unknown>>(value: unknown): value is FilterSet<T> {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === FilterSet.BRAND
        );
    }

    private static normalizeDefineConfig<T extends Record<string, unknown>>(
        config: FilterSetDefineConfig<T>
    ): Record<string, FilterResolver<T>> {
        const spec: Record<string, FilterResolver<T>> = {};
        const fieldDeclarations: Partial<Record<string, FieldFilterDeclaration>> = config.fields ?? {};
        const fieldParsers: Partial<Record<string, FilterValueParser>> = config.parsers ?? {};

        for (const rawField of Object.keys(fieldDeclarations) as Array<FilterFieldRef<T>>) {
            const declaration = fieldDeclarations[rawField];
            if (declaration === undefined) continue;
            const parser = fieldParsers[rawField];
            FilterSet.addFieldDeclaration(spec, rawField, declaration, parser);
        }

        const aliases = config.aliases ?? {};
        for (const [param, declaration] of Object.entries(aliases)) {
            spec[param] = FilterSet.normalizeAliasDeclaration(declaration);
        }

        return spec;
    }

    private static addFieldDeclaration<T extends Record<string, unknown>>(
        spec: Record<string, FilterResolver<T>>,
        field: FilterFieldRef<T>,
        declaration: FieldFilterDeclaration,
        parser: FilterValueParser | undefined
    ): void {
        if (declaration === true) {
            spec[String(field)] = FilterSet.createLookupResolver(field, InternalFilterLookup.EXACT, parser);
            return;
        }

        if (FilterSet.isLookupArray(declaration)) {
            for (const lookup of declaration) {
                const param = FilterSet.resolveLookupParam(String(field), lookup);
                spec[param] = FilterSet.createLookupResolver(field, lookup, parser);
            }
            return;
        }

        const lookups = declaration.lookups ?? [InternalFilterLookup.EXACT];
        const baseParam = declaration.param ?? String(field);
        const effectiveParser = declaration.parse ?? parser;

        for (const lookup of lookups) {
            const param = FilterSet.resolveLookupParam(baseParam, lookup);
            spec[param] = FilterSet.createLookupResolver(field, lookup, effectiveParser);
        }
    }

    private static isLookupArray(value: FieldFilterDeclaration): value is readonly FilterLookup[] {
        return Array.isArray(value);
    }

    private static normalizeAliasDeclaration<T extends Record<string, unknown>>(
        declaration: AliasFilterDeclaration<T>
    ): FilterResolver<T> {
        if (FilterSet.isFilterResolverDeclaration(declaration)) {
            return declaration;
        }

        if ('fields' in declaration) {
            const lookup = declaration.lookup ?? InternalFilterLookup.ICONTAINS;
            return FilterSet.createMultiFieldResolver(declaration.fields, lookup, declaration.parse);
        }

        return FilterSet.createLookupResolver(
            declaration.field,
            declaration.lookup ?? InternalFilterLookup.EXACT,
            declaration.parse
        );
    }

    private static isFilterResolverDeclaration<T extends Record<string, unknown>>(
        value: AliasFilterDeclaration<T>
    ): value is FilterResolver<T> {
        if (typeof value !== 'object' || value === null || !('type' in value)) {
            return false;
        }

        return [
            InternalFilterType.SCALAR,
            InternalFilterType.ILIKE,
            InternalFilterType.RANGE,
            InternalFilterType.IN,
            InternalFilterType.CUSTOM,
        ].includes(value.type);
    }

    private static createMultiFieldResolver<T extends Record<string, unknown>>(
        fields: readonly FilterFieldRef<T>[],
        lookup: FilterLookup,
        parser?: FilterValueParser
    ): FilterResolver<T> {
        if (lookup === InternalFilterLookup.ICONTAINS && parser === undefined) {
            return { type: InternalFilterType.ILIKE, columns: [...fields] };
        }

        return {
            type: InternalFilterType.CUSTOM,
            apply: (raw) => {
                const parsed = FilterSet.resolveParserValue(raw, parser);
                if (parsed === undefined) return undefined;

                const composed: Partial<Record<FilterKey<T>, FilterValue>> = {};
                for (const field of fields) {
                    const segment = FilterSet.resolveLookupFilter(field, lookup, parsed);
                    if (!segment) continue;
                    Object.assign(composed, segment);
                }

                return Object.keys(composed).length > 0 ? (composed as FilterInput<T>) : undefined;
            },
        };
    }

    private static createLookupResolver<T extends Record<string, unknown>>(
        field: FilterFieldRef<T>,
        lookup: FilterLookup,
        parser?: FilterValueParser
    ): FilterResolver<T> {
        if (parser !== undefined) {
            return {
                type: InternalFilterType.CUSTOM,
                apply: (raw) => {
                    const parsed = FilterSet.resolveParserValue(raw, parser);
                    if (parsed === undefined) return undefined;
                    return FilterSet.resolveLookupFilter(field, lookup, parsed);
                },
            };
        }

        switch (lookup) {
            case 'exact':
                return { type: InternalFilterType.SCALAR, column: field };
            case 'in':
                return { type: InternalFilterType.IN, column: field };
            case 'lt':
            case 'lte':
            case 'gt':
            case 'gte':
                return { type: InternalFilterType.RANGE, column: field, op: lookup };
            case 'icontains':
                return { type: InternalFilterType.ILIKE, columns: [field] };
            default:
                return {
                    type: InternalFilterType.CUSTOM,
                    apply: (raw) => FilterSet.resolveLookupFilter(field, lookup, raw),
                };
        }
    }

    private static resolveLookupFilter<T extends Record<string, unknown>>(
        field: FilterFieldRef<T>,
        lookup: FilterLookup,
        value: ResolvedFilterValue | undefined
    ): FilterInput<T> | undefined {
        if (value === undefined) return undefined;

        if (lookup === 'exact') {
            return { [field]: value } as FilterInput<T>;
        }

        if (lookup === 'in') {
            const arr = Array.isArray(value) ? value : String(value).split(',');
            const lookupKey = `${String(field)}__in` as FilterKey<T>;
            return { [lookupKey]: arr } as FilterInput<T>;
        }

        if (lookup === 'icontains') {
            const lookupKey = `${String(field)}__icontains` as FilterKey<T>;
            return { [lookupKey]: `%${FilterSet.toScalarString(value)}%` } as FilterInput<T>;
        }

        const lookupKey = `${String(field)}__${lookup}` as FilterKey<T>;
        return { [lookupKey]: value as FilterValue } as FilterInput<T>;
    }

    private static resolveLookupParam(baseParam: string, lookup: FilterLookup): string {
        if (lookup === 'exact') {
            return baseParam;
        }
        return `${baseParam}__${lookup}`;
    }

    private static resolveParserValue(
        value: string | string[] | undefined,
        parser?: FilterValueParser
    ): ResolvedFilterValue | undefined {
        if (value === undefined) {
            return undefined;
        }

        if (parser === undefined) {
            return value;
        }

        return parser(value);
    }

    private static toScalarString(value: ResolvedFilterValue): string {
        if (Array.isArray(value)) {
            return value.join(',');
        }
        return String(value);
    }

    /**
     * Return a new filter set with parser-aware scalar/range/in resolvers for matching fields.
     */
    withFieldParsers(parsers: Partial<Record<string, FilterValueParser>>): FilterSet<T> {
        if (Object.keys(parsers).length === 0) {
            return this;
        }

        let changed = false;
        const nextSpec = Object.fromEntries(
            Object.entries(this.spec).map(([param, resolver]) => {
                const nextResolver = this.applyFieldParserOverride(resolver, parsers);
                if (nextResolver !== resolver) {
                    changed = true;
                }
                return [param, nextResolver];
            })
        ) as Record<string, FilterResolver<T>>;

        return changed ? new FilterSet(nextSpec, this.allowAllParams) : this;
    }

    /**
     * Apply all configured resolvers against query params.
     */
    apply(params: TangoQueryParams): FilterInput<T>[] {
        const filters: FilterInput<T>[] = [];
        const keys = new Set<string>();

        for (const [key] of params.entries()) {
            keys.add(key);
        }

        for (const key of keys) {
            const resolver = this.spec[key] ?? (this.allowAllParams ? this.buildAllResolver(key) : undefined);
            if (!resolver) continue;

            const rawValue = params.getAll(key);
            const value = rawValue.length > 1 ? rawValue : rawValue[0];

            if (value === undefined) continue;

            const filter = this.resolveFilter(resolver, value);
            if (filter) {
                filters.push(filter);
            }
        }

        return filters;
    }

    private buildAllResolver(param: string): FilterResolver<T> | undefined {
        const segments = param.split('__').filter(Boolean);
        if (segments.length === 0) {
            return undefined;
        }

        const lastSegment = segments.at(-1)!;
        const lookup = isFilterLookup(lastSegment) ? lastSegment : 'exact';
        const field = (lookup === 'exact' ? segments : segments.slice(0, -1)).join('__') as FilterFieldRef<T>;

        if (!field) {
            return undefined;
        }

        if (lookup === 'exact') {
            return { type: InternalFilterType.SCALAR, column: field };
        }

        return FilterSet.createLookupResolver(field, lookup);
    }

    private resolveFilter(
        resolver: FilterResolver<T>,
        value: string | string[] | undefined
    ): FilterInput<T> | undefined {
        if (value === undefined) return undefined;

        switch (resolver.type) {
            case InternalFilterType.SCALAR:
                return { [resolver.column]: value } as FilterInput<T>;

            case InternalFilterType.ILIKE: {
                const pattern = `%${FilterSet.toScalarString(value)}%`;
                const filter: Partial<Record<FilterKey<T>, FilterValue>> = {};
                resolver.columns.forEach((col) => {
                    filter[`${String(col)}__icontains` as FilterKey<T>] = pattern;
                });
                return filter;
            }

            case InternalFilterType.RANGE: {
                const lookupKey = `${String(resolver.column)}__${resolver.op}` as keyof FilterInput<T>;
                return { [lookupKey]: value } as FilterInput<T>;
            }

            case InternalFilterType.IN: {
                const arr = Array.isArray(value) ? value : String(value).split(',');
                const lookupKey = `${String(resolver.column)}__in` as keyof FilterInput<T>;
                return { [lookupKey]: arr } as FilterInput<T>;
            }

            case InternalFilterType.CUSTOM:
                return resolver.apply(value);

            default:
                return undefined;
        }
    }

    private applyFieldParserOverride(
        resolver: FilterResolver<T>,
        parsers: Partial<Record<string, FilterValueParser>>
    ): FilterResolver<T> {
        switch (resolver.type) {
            case InternalFilterType.SCALAR: {
                const parser = parsers[resolver.column];
                return parser ? FilterSet.createLookupResolver(resolver.column, 'exact', parser) : resolver;
            }

            case InternalFilterType.RANGE: {
                const parser = parsers[resolver.column];
                return parser ? FilterSet.createLookupResolver(resolver.column, resolver.op, parser) : resolver;
            }

            case InternalFilterType.IN: {
                const parser = parsers[resolver.column];
                return parser ? FilterSet.createLookupResolver(resolver.column, 'in', parser) : resolver;
            }

            default:
                return resolver;
        }
    }
}
