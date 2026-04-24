import { describe, expect, it } from 'vitest';
import { anAdapter } from '@danceroutine/tango-testing';
import { MutationCompiler } from '../MutationCompiler';
import type {
    ValidatedDeleteSqlPlan,
    ValidatedInsertSqlPlan,
    ValidatedSelectSqlPlan,
    ValidatedUpdateSqlPlan,
} from '../../../validation/SQLValidationEngine';
import { InternalSqlValidationPlanKind as SqlPlanKind } from '../../../validation/internal/InternalSqlValidationPlanKind';
import { InternalValidatedFilterDescriptorKind } from '../../../validation/internal/InternalValidatedFilterDescriptorKind';

const insertPlan: ValidatedInsertSqlPlan = {
    kind: SqlPlanKind.INSERT,
    meta: {
        table: 'users',
        pk: 'id',
        columns: { id: 'int', email: 'text', active: 'bool' },
    },
    writeKeys: ['email', 'active'],
};

const updatePlan: ValidatedUpdateSqlPlan = {
    kind: SqlPlanKind.UPDATE,
    meta: insertPlan.meta,
    writeKeys: ['email', 'active'],
};

const deletePlan: ValidatedDeleteSqlPlan = {
    kind: SqlPlanKind.DELETE,
    meta: insertPlan.meta,
};

const joinDeletePlan: ValidatedSelectSqlPlan = {
    kind: SqlPlanKind.SELECT,
    meta: {
        table: 'm2m_posts_tags',
        pk: 'id',
        columns: { id: 'int', post_id: 'int', tag_id: 'int' },
    },
    selectFields: {},
    filterKeys: {
        post_id: {
            kind: InternalValidatedFilterDescriptorKind.COLUMN,
            rawKey: 'post_id',
            field: 'post_id',
            lookup: 'exact',
            qualifiedColumn: 'm2m_posts_tags.post_id',
        },
        tag_id: {
            kind: InternalValidatedFilterDescriptorKind.COLUMN,
            rawKey: 'tag_id',
            field: 'tag_id',
            lookup: 'exact',
            qualifiedColumn: 'm2m_posts_tags.tag_id',
        },
    },
    orderFields: {},
    relations: {},
};

describe(MutationCompiler, () => {
    it('compiles postgres insert, update, delete, and bulk insert queries', () => {
        const compiler = new MutationCompiler(anAdapter({ dialect: 'postgres' }));

        expect(compiler.compileInsert(insertPlan, ['user@example.com', true])).toEqual({
            sql: 'INSERT INTO users (email, active) VALUES ($1, $2) RETURNING *',
            params: ['user@example.com', true],
        });
        expect(compiler.compileUpdate(updatePlan, ['user@example.com', false], 1)).toEqual({
            sql: 'UPDATE users SET email = $1, active = $2 WHERE id = $3 RETURNING *',
            params: ['user@example.com', false, 1],
        });
        expect(compiler.compileDelete(deletePlan, 1)).toEqual({
            sql: 'DELETE FROM users WHERE id = $1',
            params: [1],
        });
        expect(
            compiler.compileBulkInsert(insertPlan, [
                ['first@example.com', true],
                ['second@example.com', false],
            ])
        ).toEqual({
            sql: 'INSERT INTO users (email, active) VALUES ($1, $2), ($3, $4) RETURNING *',
            params: ['first@example.com', true, 'second@example.com', false],
        });
        expect(compiler.compileDeleteByJoinKeys(joinDeletePlan, 'post_id', 'tag_id', 1, 2)).toEqual({
            sql: 'DELETE FROM m2m_posts_tags WHERE post_id = $1 AND tag_id = $2',
            params: [1, 2],
        });
    });

    it('compiles sqlite insert, update, delete, and bulk insert queries', () => {
        const compiler = new MutationCompiler(anAdapter({ dialect: 'sqlite' }));

        expect(compiler.compileInsert(insertPlan, ['user@example.com', true])).toEqual({
            sql: 'INSERT INTO users (email, active) VALUES (?, ?) RETURNING *',
            params: ['user@example.com', true],
        });
        expect(compiler.compileUpdate(updatePlan, ['user@example.com', false], 1)).toEqual({
            sql: 'UPDATE users SET email = ?, active = ? WHERE id = ? RETURNING *',
            params: ['user@example.com', false, 1],
        });
        expect(compiler.compileDelete(deletePlan, 1)).toEqual({
            sql: 'DELETE FROM users WHERE id = ?',
            params: [1],
        });
        expect(
            compiler.compileBulkInsert(insertPlan, [
                ['first@example.com', true],
                ['second@example.com', false],
            ])
        ).toEqual({
            sql: 'INSERT INTO users (email, active) VALUES (?, ?), (?, ?) RETURNING *',
            params: ['first@example.com', true, 'second@example.com', false],
        });
        expect(compiler.compileDeleteByJoinKeys(joinDeletePlan, 'post_id', 'tag_id', 1, 2)).toEqual({
            sql: 'DELETE FROM m2m_posts_tags WHERE post_id = ? AND tag_id = ?',
            params: [1, 2],
        });
    });

    it('throws when compileDeleteByJoinKeys is called with unvalidated filter keys', () => {
        const compiler = new MutationCompiler(anAdapter({ dialect: 'postgres' }));
        expect(() => compiler.compileDeleteByJoinKeys(joinDeletePlan, 'post_id', 'unknown_column', 1, 2)).toThrow(
            /filter keys.*must be present on the validated plan/
        );
    });

    it('throws when compileDeleteJoinLinks is called with missing filter keys or no targets', () => {
        const compiler = new MutationCompiler(anAdapter({ dialect: 'postgres' }));

        expect(() => compiler.compileDeleteJoinLinks(joinDeletePlan, 'post_id', 'missing_column', 1, [2])).toThrow(
            /filter keys.*must be present on the validated plan/
        );
        expect(() => compiler.compileDeleteJoinLinks(joinDeletePlan, 'post_id', 'tag_id', 1, [])).toThrow(
            /requires at least one target value/i
        );
    });
});
