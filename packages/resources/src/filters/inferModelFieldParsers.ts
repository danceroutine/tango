import type { ResourceModelLike } from '../resource/index';
import type { FilterValueParser } from './FilterSet';

function normalizeParserTokens(raw: string | string[]): string[] {
    const tokens = Array.isArray(raw) ? raw : String(raw).split(',');
    const normalized = tokens.map((value) => value.trim());
    return normalized.every((value) => value.length > 0) ? normalized : [];
}

function createBooleanParser(): FilterValueParser {
    return (raw) => {
        const values = normalizeParserTokens(raw);
        if (values.length === 0) {
            return undefined;
        }

        const parsed = values.map((value) => {
            const normalized = value.toLowerCase();

            if (normalized === 'true' || normalized === '1') {
                return true;
            }

            if (normalized === 'false' || normalized === '0') {
                return false;
            }

            return null;
        });

        if (parsed.some((value) => value === null)) {
            return undefined;
        }

        return parsed.length === 1 ? parsed[0]! : (parsed as boolean[]);
    };
}

function createIntegerParser(): FilterValueParser {
    return (raw) => {
        const values = normalizeParserTokens(raw);
        if (values.length === 0) {
            return undefined;
        }

        const parsed = values.map(Number);

        if (parsed.some((value) => !Number.isInteger(value))) {
            return undefined;
        }

        return parsed.length === 1 ? parsed[0] : parsed;
    };
}

function createTimestampParser(): FilterValueParser {
    return (raw) => {
        const values = normalizeParserTokens(raw);
        if (values.length === 0) {
            return undefined;
        }

        const parsed = values.map((value) => {
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? null : date;
        });

        if (parsed.some((value) => value === null)) {
            return undefined;
        }

        return parsed.length === 1 ? parsed[0]! : (parsed as Date[]);
    };
}

/**
 * Infer resource-level query-value parsers from Tango model metadata.
 *
 * Parsers are inferred conservatively from field metadata so HTTP query filters
 * can be coerced into typed ORM inputs without framework-specific glue.
 */
export function inferModelFieldParsers<T extends Record<string, unknown>>(
    model: ResourceModelLike<T>
): Partial<Record<keyof T, FilterValueParser>> {
    const metadata = model.metadata;
    if (!metadata) {
        return {};
    }

    const parsers: Partial<Record<keyof T, FilterValueParser>> = {};

    for (const field of metadata.fields) {
        switch (field.type) {
            case 'bool':
                parsers[field.name as keyof T] = createBooleanParser();
                break;
            case 'serial':
            case 'int':
            case 'bigint':
                parsers[field.name as keyof T] = createIntegerParser();
                break;
            case 'timestamptz':
                parsers[field.name as keyof T] = createTimestampParser();
                break;
            default:
                break;
        }
    }

    return parsers;
}
