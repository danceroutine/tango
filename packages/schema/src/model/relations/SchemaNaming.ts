/**
 * Shared naming policy for the model and relations subdomains.
 *
 * These helpers are not an authoring or graph stage on their own. They are the
 * cross-cutting policy layer used by both model construction and relation
 * resolution when Tango derives table names, aliases, and synthesized relation
 * names in a Django-style shape.
 */
export function toSnakeCase(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
}

export function pluralize(value: string): string {
    if (/(s|x|z|ch|sh)$/.test(value)) {
        return `${value}es`;
    }

    if (/[^aeiou]y$/.test(value)) {
        return `${value.slice(0, -1)}ies`;
    }

    return `${value}s`;
}

export function deriveTableName(name: string): string {
    return pluralize(toSnakeCase(name));
}

export function decapitalizeModelName(name: string): string {
    if (name.length === 0) {
        return name;
    }
    return `${name[0]!.toLowerCase()}${name.slice(1)}`;
}
