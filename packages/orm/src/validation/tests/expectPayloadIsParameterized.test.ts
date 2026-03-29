import { describe, expect, it } from 'vitest';
import { expectPayloadIsParameterized } from './expectPayloadIsParameterized';

describe(expectPayloadIsParameterized, () => {
    it('accepts payloads that stay out of SQL text and remain in bound params', () => {
        expect(() =>
            expectPayloadIsParameterized('select * from users where email = $1', ["' OR 1=1 --"], "' OR 1=1 --")
        ).not.toThrow();
    });

    it('rejects payloads that leak into SQL text', () => {
        expect(() =>
            expectPayloadIsParameterized(
                "select * from users where email = '' OR 1=1 --'",
                ["' OR 1=1 --"],
                "' OR 1=1 --"
            )
        ).toThrow(/stay out of SQL text/i);
    });

    it('rejects payloads that are missing from bound params', () => {
        expect(() =>
            expectPayloadIsParameterized('select * from users where email = $1', ['safe@example.com'], "' OR 1=1 --")
        ).toThrow(/bound parameter/i);
    });
});
