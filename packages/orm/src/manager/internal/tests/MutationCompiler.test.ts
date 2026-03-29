import { describe, expect, it } from 'vitest';
import { MutationCompiler } from '../MutationCompiler';
import type {
    ValidatedDeleteSqlPlan,
    ValidatedInsertSqlPlan,
    ValidatedUpdateSqlPlan,
} from '../../../validation/SQLValidationEngine';

const insertPlan: ValidatedInsertSqlPlan = {
    kind: 'insert',
    meta: {
        table: 'users',
        pk: 'id',
        columns: { id: 'int', email: 'text', active: 'bool' },
    },
    writeKeys: ['email', 'active'],
};

const updatePlan: ValidatedUpdateSqlPlan = {
    kind: 'update',
    meta: insertPlan.meta,
    writeKeys: ['email', 'active'],
};

const deletePlan: ValidatedDeleteSqlPlan = {
    kind: 'delete',
    meta: insertPlan.meta,
};

describe(MutationCompiler, () => {
    it('compiles postgres insert, update, delete, and bulk insert queries', () => {
        const compiler = new MutationCompiler('postgres');

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
    });

    it('compiles sqlite insert, update, delete, and bulk insert queries', () => {
        const compiler = new MutationCompiler('sqlite');

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
    });
});
