import type { IndexDef } from '../../domain/index';

export type ModelConstraint = {
    kind: string;
    [key: string]: unknown;
};

export type ModelMetaFragment = {
    ordering?: string[];
    managed?: boolean;
    defaultRelatedName?: string;
    indexes?: IndexDef[];
    constraints?: ModelConstraint[];
};

export const Meta = {
    ordering(...fields: string[]): ModelMetaFragment {
        return { ordering: fields };
    },

    managed(value: boolean): ModelMetaFragment {
        return { managed: value };
    },

    defaultRelatedName(value: string): ModelMetaFragment {
        return { defaultRelatedName: value };
    },

    indexes(...indexes: IndexDef[]): ModelMetaFragment {
        return { indexes };
    },

    constraints(...constraints: ModelConstraint[]): ModelMetaFragment {
        return { constraints };
    },

    uniqueTogether(...sets: string[][]): ModelMetaFragment {
        return {
            constraints: sets.map((fields) => ({ kind: 'uniqueTogether', fields })),
        };
    },

    indexTogether(...sets: string[][]): ModelMetaFragment {
        return {
            indexes: sets.map((on, index) => ({
                name: `idx_${on.join('_')}_${index}`,
                on,
            })),
        };
    },

    merge(...fragments: readonly ModelMetaFragment[]): ModelMetaFragment {
        return fragments.reduce<ModelMetaFragment>(
            (acc, fragment) => ({
                ordering: fragment.ordering ?? acc.ordering,
                managed: fragment.managed ?? acc.managed,
                defaultRelatedName: fragment.defaultRelatedName ?? acc.defaultRelatedName,
                indexes: [...(acc.indexes ?? []), ...(fragment.indexes ?? [])],
                constraints: [...(acc.constraints ?? []), ...(fragment.constraints ?? [])],
            }),
            {}
        );
    },
};
