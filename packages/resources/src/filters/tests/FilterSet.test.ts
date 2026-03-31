import { describe, expect, it } from 'vitest';
import { TangoQueryParams } from '@danceroutine/tango-core';
import { FilterSet, type FieldFilterDeclaration } from '../FilterSet';
import type { FilterInput } from '@danceroutine/tango-orm';

type UserFilterModel = {
    id: number;
    age: number;
    email: string;
    name: string;
    active: boolean;
};

function query(input: string = ''): TangoQueryParams {
    return TangoQueryParams.fromURLSearchParams(new URLSearchParams(input));
}

describe(FilterSet, () => {
    it('applies scalar filter', () => {
        const filters = new FilterSet<{ id: number; email: string }>({
            id: { type: 'scalar', column: 'id' },
        });

        const params = query('id=123');
        const result = filters.apply(params);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ id: '123' });
    });

    it('applies ilike filter', () => {
        const filters = new FilterSet<{ name: string; email: string }>({
            q: { type: 'ilike', columns: ['name', 'email'] },
        });

        const params = query('q=john');
        const result = filters.apply(params);

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('name__icontains');
        expect(result[0]).toHaveProperty('email__icontains');
    });

    it('applies range filter', () => {
        const filters = new FilterSet<{ age: number }>({
            min_age: { type: 'range', column: 'age', op: 'gte' },
        });

        const params = query('min_age=18');
        const result = filters.apply(params);

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('age__gte', '18');
    });

    it('applies in filter', () => {
        const filters = new FilterSet<{ id: number }>({
            ids: { type: 'in', column: 'id' },
        });

        const params = query('ids=1,2,3');
        const result = filters.apply(params);

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('id__in');
    });

    it('applies in filter from repeated query params as array input', () => {
        const filters = new FilterSet<{ id: number }>({
            ids: { type: 'in', column: 'id' },
        });
        const params = query('ids=1&ids=2');
        const result = filters.apply(params);
        expect(result[0]).toEqual({ id__in: ['1', '2'] });
    });

    it('applies custom filter', () => {
        const filters = new FilterSet<{ email: string }>({
            domain: {
                type: 'custom',
                apply: (value) => {
                    if (!value) return undefined;
                    return { email__iendswith: `@${value}` } as FilterInput<{ email: string }>;
                },
            },
        });

        const params = query('domain=example.com');
        const result = filters.apply(params);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ email__iendswith: '@example.com' });
    });

    it('ignores unknown params by default', () => {
        const filters = FilterSet.define<UserFilterModel>({
            fields: {
                id: true,
            },
        });
        const params = query('email=ignore@example.com');
        const result = filters.apply(params);
        expect(result).toEqual([]);
    });

    it('builds scalar field filters from define fields=true', () => {
        const filters = FilterSet.define<UserFilterModel>({
            fields: {
                email: true,
            },
        });

        const result = filters.apply(query('email=user@example.com'));
        expect(result).toEqual([{ email: 'user@example.com' }]);
    });

    it('builds lookup filters from define lookup arrays', () => {
        const filters = FilterSet.define<UserFilterModel>({
            fields: {
                age: ['gte', 'lte'],
            },
        });

        const result = filters.apply(query('age__gte=18&age__lte=65'));
        expect(result).toEqual([{ age__gte: '18' }, { age__lte: '65' }]);
    });

    it('supports field parser maps and omits undefined parser output', () => {
        const filters = FilterSet.define<UserFilterModel>({
            fields: {
                age: ['gte'],
            },
            parsers: {
                age: (raw) => {
                    const value = Array.isArray(raw) ? raw[0] : raw;
                    if (!value) return undefined;
                    const parsed = Number(value);
                    return Number.isNaN(parsed) ? undefined : parsed;
                },
            },
        });

        const applied = filters.apply(query('age__gte=21'));
        expect(applied).toEqual([{ age__gte: 21 }]);

        const omitted = filters.apply(query('age__gte=oops'));
        expect(omitted).toEqual([]);
    });

    it('uses parser fallback for object field declarations', () => {
        const filters = FilterSet.define<UserFilterModel>({
            fields: {
                age: {
                    lookups: ['gte'],
                },
            },
            parsers: {
                age: (raw) => Number(Array.isArray(raw) ? raw[0] : raw),
            },
        });

        const result = filters.apply(query('age__gte=42'));
        expect(result).toEqual([{ age__gte: 42 }]);
    });

    it('supports field declaration param aliases and parser overrides', () => {
        const filters = FilterSet.define<UserFilterModel>({
            fields: {
                active: {
                    param: 'is_active',
                    parse: (raw) => {
                        const value = (Array.isArray(raw) ? raw[0] : raw)?.toLowerCase();
                        if (value === 'true') return true;
                        if (value === 'false') return false;
                        return undefined;
                    },
                },
            },
        });

        const result = filters.apply(query('is_active=true'));
        expect(result).toEqual([{ active: true }]);
    });

    it('can enrich scalar, range, and in filters with field parser overrides after definition', () => {
        const filters = FilterSet.define<UserFilterModel>({
            fields: {
                active: true,
                age: ['gte', 'in'],
            },
        }).withFieldParsers({
            active: (raw) => {
                const value = (Array.isArray(raw) ? raw[0] : raw)?.toLowerCase();
                if (value === 'true') return true;
                if (value === 'false') return false;
                return undefined;
            },
            age: (raw) => {
                const values = Array.isArray(raw) ? raw : String(raw).split(',');
                const parsed = values.map(Number);
                return parsed.length === 1 ? parsed[0] : parsed;
            },
        });

        expect(filters.apply(query('active=true'))).toEqual([{ active: true }]);
        expect(filters.apply(query('age__gte=21'))).toEqual([{ age__gte: 21 }]);
        expect(filters.apply(query('age__in=1,2,3'))).toEqual([{ age__in: [1, 2, 3] }]);
    });

    it('leaves non-scalar filter resolvers unchanged when applying field parser overrides', () => {
        const filters = FilterSet.define<UserFilterModel>({
            aliases: {
                q: {
                    fields: ['name', 'email'],
                },
            },
        }).withFieldParsers({
            active: (raw) => raw,
        });

        expect(filters.apply(query('q=pedro'))).toEqual([{ name__icontains: '%pedro%', email__icontains: '%pedro%' }]);
    });

    it('leaves range and in resolvers unchanged when no matching parser override exists', () => {
        const filters = FilterSet.define<UserFilterModel>({
            fields: {
                age: ['gte', 'in'],
            },
        }).withFieldParsers({
            active: (raw) => raw,
        });

        expect(filters.apply(query('age__gte=21'))).toEqual([{ age__gte: '21' }]);
        expect(filters.apply(query('age__in=1,2,3'))).toEqual([{ age__in: ['1', '2', '3'] }]);
    });

    it('supports alias declarations for single-field lookups', () => {
        const filters = FilterSet.define<UserFilterModel>({
            aliases: {
                username: {
                    field: 'name',
                },
            },
        });

        const result = filters.apply(query('username=pedro'));
        expect(result).toEqual([{ name: 'pedro' }]);
    });

    it('supports alias declarations across multiple fields', () => {
        const filters = FilterSet.define<UserFilterModel>({
            aliases: {
                q: {
                    fields: ['name', 'email'],
                    lookup: 'icontains',
                },
            },
        });

        const result = filters.apply(query('q=pedro'));
        expect(result).toEqual([{ name__icontains: '%pedro%', email__icontains: '%pedro%' }]);
    });

    it('defaults multi-field alias lookups to icontains when lookup is omitted', () => {
        const filters = FilterSet.define<UserFilterModel>({
            aliases: {
                q: {
                    fields: ['name', 'email'],
                },
            },
        });

        const result = filters.apply(query('q=pedro'));
        expect(result).toEqual([{ name__icontains: '%pedro%', email__icontains: '%pedro%' }]);
    });

    it('supports __all__ mode when explicitly enabled', () => {
        const filters = FilterSet.define<UserFilterModel>({
            all: '__all__',
        });

        const result = filters.apply(query('email=user@example.com&age__gte=18'));
        expect(result).toEqual([{ email: 'user@example.com' }, { age__gte: '18' }]);
    });

    it('skips keys whose normalized values resolve to nothing', () => {
        const filters = FilterSet.define<UserFilterModel>({
            fields: {
                email: true,
            },
        });

        const params = {
            *entries(): IterableIterator<[string, string[]]> {
                yield ['email', ['user@example.com']];
            },
            getAll(): string[] {
                return [];
            },
        } as unknown as TangoQueryParams;

        expect(filters.apply(params)).toEqual([]);
    });

    it('supports all lookup branches through define declarations', () => {
        const filters = FilterSet.define<UserFilterModel>({
            fields: {
                id: ['exact', 'in', 'lt', 'lte', 'gt', 'gte'],
                name: ['icontains', 'contains', 'startswith', 'istartswith', 'endswith', 'iendswith'],
                active: ['isnull'],
            },
            aliases: {
                legacy_id: { type: 'scalar', column: 'id' },
                text: { fields: ['name', 'email'], lookup: 'contains' },
            },
        });

        const params = query(
            [
                'id=1',
                'id__in=1,2,3',
                'id__lt=10',
                'id__lte=10',
                'id__gt=0',
                'id__gte=1',
                'name__icontains=foo',
                'name__contains=foo',
                'name__startswith=fo',
                'name__istartswith=fo',
                'name__endswith=oo',
                'name__iendswith=oo',
                'active__isnull=false',
                'legacy_id=2',
                'text=bar',
            ].join('&')
        );

        const result = filters.apply(params);
        expect(result).toEqual([
            { id: '1' },
            { id__in: ['1', '2', '3'] },
            { id__lt: '10' },
            { id__lte: '10' },
            { id__gt: '0' },
            { id__gte: '1' },
            { name__icontains: '%foo%' },
            { name__contains: 'foo' },
            { name__startswith: 'fo' },
            { name__istartswith: 'fo' },
            { name__endswith: 'oo' },
            { name__iendswith: 'oo' },
            { active__isnull: 'false' },
            { id: '2' },
            { name__contains: 'bar', email__contains: 'bar' },
        ]);
    });

    it('returns no filter for empty multi-field aliases', () => {
        const filters = FilterSet.define<UserFilterModel>({
            aliases: {
                q: { fields: [], lookup: 'contains' },
            },
        });

        const result = filters.apply(query('q=value'));
        expect(result).toEqual([]);
    });

    it('bubbles parser exceptions through the existing error path', () => {
        const filters = FilterSet.define<UserFilterModel>({
            fields: {
                age: {
                    lookups: ['gte'],
                    parse: () => {
                        throw new Error('bad-number');
                    },
                },
            },
        });

        expect(() => filters.apply(query('age__gte=foo'))).toThrow('bad-number');
    });

    it('covers internal helper edge branches', () => {
        const internalClass = FilterSet as unknown as {
            resolveParserValue: (
                value: string | string[] | undefined,
                parser?: (raw: string | string[]) => unknown
            ) => unknown;
            toScalarString: (value: unknown) => string;
            resolveLookupFilter: (
                field: keyof UserFilterModel,
                lookup: string,
                value: unknown
            ) => FilterInput<UserFilterModel> | undefined;
            isFilterResolverDeclaration: (value: unknown) => boolean;
        };

        expect(internalClass.resolveParserValue(undefined)).toBeUndefined();
        expect(internalClass.resolveParserValue('raw')).toBe('raw');
        expect(internalClass.toScalarString(['a', 'b'])).toBe('a,b');
        expect(internalClass.resolveLookupFilter('id', 'exact', undefined)).toBeUndefined();
        expect(internalClass.resolveLookupFilter('id', 'in', '1,2')).toEqual({ id__in: ['1', '2'] });
        expect(internalClass.resolveLookupFilter('id', 'in', [1, 2])).toEqual({ id__in: [1, 2] });
        expect(internalClass.resolveLookupFilter('name', 'icontains', 'foo')).toEqual({
            name__icontains: '%foo%',
        });

        expect(internalClass.isFilterResolverDeclaration({ type: 'scalar', column: 'id' })).toBe(true);
        expect(internalClass.isFilterResolverDeclaration({ type: 'ilike', columns: ['name'] })).toBe(true);
        expect(internalClass.isFilterResolverDeclaration({ type: 'range', column: 'id', op: 'gte' })).toBe(true);
        expect(internalClass.isFilterResolverDeclaration({ type: 'in', column: 'id' })).toBe(true);
        expect(internalClass.isFilterResolverDeclaration({ type: 'custom', apply: () => ({ id: 1 }) })).toBe(true);
    });

    it('covers __all__ empty key handling', () => {
        const filters = FilterSet.define<UserFilterModel>({
            all: '__all__',
        });

        const result = filters.apply(query('=value'));
        expect(result).toEqual([]);
    });

    it('ignores undefined field declarations in define config', () => {
        const fields: Partial<Record<keyof UserFilterModel, FieldFilterDeclaration>> = {
            email: true,
        };
        Object.defineProperty(fields, 'id', {
            value: undefined,
            enumerable: true,
        });

        const filters = FilterSet.define<UserFilterModel>({
            fields,
        });

        const result = filters.apply(query('email=user@example.com&id=1'));
        expect(result).toEqual([{ email: 'user@example.com' }]);
    });

    it('covers multi-field custom resolver branch when lookup segment is skipped', () => {
        const internalClass = FilterSet as unknown as {
            resolveLookupFilter: (field: keyof UserFilterModel, lookup: string, value: unknown) => unknown;
        };
        const original = internalClass.resolveLookupFilter;
        internalClass.resolveLookupFilter = () => undefined;

        try {
            const filters = FilterSet.define<UserFilterModel>({
                aliases: {
                    q: { fields: ['name', 'email'], lookup: 'contains' },
                },
            });
            const result = filters.apply(query('q=skip'));
            expect(result).toEqual([]);
        } finally {
            internalClass.resolveLookupFilter = original;
        }
    });

    it('returns undefined when custom multi-field parser omits a value', () => {
        const filters = FilterSet.define<UserFilterModel>({
            aliases: {
                q: {
                    fields: ['name', 'email'],
                    lookup: 'contains',
                    parse: () => undefined,
                },
            },
        });

        const result = filters.apply(query('q=pedro'));
        expect(result).toEqual([]);
    });

    it('ignores undefined values', () => {
        const filters = new FilterSet<{ id: number }>({
            id: { type: 'scalar', column: 'id' },
        });

        const params = query();
        const result = filters.apply(params);

        expect(result).toHaveLength(0);
    });

    it('identifies matching instances', () => {
        const filters = new FilterSet<{ id: number }>({
            id: { type: 'scalar', column: 'id' },
        });
        expect(FilterSet.isFilterSet(filters)).toBe(true);
        expect(FilterSet.isFilterSet({})).toBe(false);
    });

    it('returns undefined for unknown resolver types', () => {
        const filters = new FilterSet<{ id: number }>({
            broken: { type: 'scalar', column: 'id' },
        });
        const testable = filters as unknown as {
            resolveFilter: (resolver: unknown, value: string | string[] | undefined) => unknown;
        };

        const result = testable.resolveFilter({ type: 'not-real' }, 'x');
        expect(result).toBeUndefined();
    });

    it('returns undefined from resolver when value is undefined', () => {
        const filters = new FilterSet<{ id: number }>({
            id: { type: 'scalar', column: 'id' },
        });
        const testable = filters as unknown as {
            resolveFilter: (resolver: unknown, value: string | string[] | undefined) => unknown;
        };

        const result = testable.resolveFilter({ type: 'scalar', column: 'id' }, undefined);
        expect(result).toBeUndefined();
    });
});
