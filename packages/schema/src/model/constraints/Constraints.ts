export type ConstraintDefinition = {
    kind: string;
    [key: string]: unknown;
};

export const Constraints = {
    unique(fields: string[], options?: { name?: string; where?: string }): ConstraintDefinition {
        return {
            kind: 'unique',
            fields,
            ...options,
        };
    },

    check(condition: string, options?: { name?: string }): ConstraintDefinition {
        return {
            kind: 'check',
            condition,
            ...options,
        };
    },

    exclusion(definition: { using?: string; elements: string[]; where?: string; name?: string }): ConstraintDefinition {
        return {
            kind: 'exclusion',
            ...definition,
        };
    },
};
