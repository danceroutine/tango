import { Migration, op, trustedSql, type Builder } from '@danceroutine/tango-migrations';

export default class Migration__20260331210000_initial extends Migration {
    id = '20260331210000_initial';

    up(m: Builder) {
        m.run(
            op.table('users').create((cols) => {
                cols.add('id', (b) => b.int().notNull().primaryKey());
                cols.add('email', (b) => b.text().notNull().unique());
                cols.add('username', (b) => b.text().notNull().unique());
                cols.add('createdAt', (b) => b.text().notNull().defaultNow());
            }),
            op.table('tags').create((cols) => {
                cols.add('id', (b) => b.int().notNull().primaryKey());
                cols.add('name', (b) => b.text().notNull().unique());
                cols.add('slug', (b) => b.text().notNull().unique());
                cols.add('createdAt', (b) => b.text().notNull().defaultNow());
            }),
            op.table('posts').create((cols) => {
                cols.add('id', (b) => b.int().notNull().primaryKey());
                cols.add('title', (b) => b.text().notNull());
                cols.add('slug', (b) => b.text().notNull().unique());
                cols.add('content', (b) => b.text().notNull());
                cols.add('excerpt', (b) => b.text());
                cols.add('authorId', (b) =>
                    b.int().notNull().references('users', 'id', { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
                );
                cols.add('published', (b) => b.bool().notNull().default(trustedSql('false')));
                cols.add('createdAt', (b) => b.text().notNull().defaultNow());
                cols.add('updatedAt', (b) => b.text().notNull().defaultNow());
            }),
            op.table('comments').create((cols) => {
                cols.add('id', (b) => b.int().notNull().primaryKey());
                cols.add('content', (b) => b.text().notNull());
                cols.add('postId', (b) =>
                    b.int().notNull().references('posts', 'id', { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
                );
                cols.add('authorId', (b) =>
                    b.int().notNull().references('users', 'id', { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
                );
                cols.add('createdAt', (b) => b.text().notNull().defaultNow());
            }),
            op.table('m2m_9144b023282bdac6').create((cols) => {
                cols.add('id', (b) => b.int().notNull().primaryKey());
                cols.add('postId', (b) => b.int().notNull().references('posts', 'id'));
                cols.add('tagId', (b) => b.int().notNull().references('tags', 'id'));
            }),
            op.index.create({
                name: 'm2m_9144b023282bdac6_uniq_pair',
                table: 'm2m_9144b023282bdac6',
                on: ['postId', 'tagId'],
                unique: true,
            })
        );
    }

    down(m: Builder) {
        m.run(
            op.index.drop({ name: 'm2m_9144b023282bdac6_uniq_pair', table: 'm2m_9144b023282bdac6' }),
            op.table('m2m_9144b023282bdac6').drop(),
            op.table('comments').drop(),
            op.table('posts').drop(),
            op.table('tags').drop(),
            op.table('users').drop()
        );
    }
}
