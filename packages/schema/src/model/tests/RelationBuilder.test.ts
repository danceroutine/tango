import { describe, it, expect } from 'vitest';
import { RelationBuilder } from '../index';

describe(RelationBuilder, () => {
    it('creates hasMany relation', () => {
        const builder = new RelationBuilder();
        const relation = builder.hasMany('Post', 'authorId');

        expect(relation).toEqual({
            type: 'hasMany',
            target: 'Post',
            foreignKey: 'authorId',
        });
    });

    it('creates belongsTo relation', () => {
        const builder = new RelationBuilder();
        const relation = builder.belongsTo('Team', 'teamId');

        expect(relation).toEqual({
            type: 'belongsTo',
            target: 'Team',
            foreignKey: 'teamId',
        });
    });

    it('creates belongsTo relation with localKey', () => {
        const builder = new RelationBuilder();
        const relation = builder.belongsTo('Team', 'teamId', 'id');

        expect(relation).toEqual({
            type: 'belongsTo',
            target: 'Team',
            foreignKey: 'teamId',
            localKey: 'id',
        });
    });

    it('creates hasOne relation', () => {
        const builder = new RelationBuilder();
        const relation = builder.hasOne('Profile', 'userId');

        expect(relation).toEqual({
            type: 'hasOne',
            target: 'Profile',
            foreignKey: 'userId',
        });
    });
});
