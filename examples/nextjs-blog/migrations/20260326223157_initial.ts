import { Migration, op, trustedSql, type Builder } from '@danceroutine/tango-migrations';

export default class Migration__20260326223157_initial extends Migration {
    id = '20260326223157_initial';

    up(m: Builder) {
        m.run(
            op.table('posts').create((cols) => {
                cols.add('id', (b) => b.int().notNull().primaryKey());
                cols.add('title', (b) => b.text().notNull());
                cols.add('slug', (b) => b.text().notNull().unique());
                cols.add('content', (b) => b.text().notNull());
                cols.add('excerpt', (b) => b.text());
                cols.add('published', (b) => b.bool().notNull().default(trustedSql('false')));
                cols.add('createdAt', (b) => b.text().notNull().defaultNow());
                cols.add('updatedAt', (b) => b.text().notNull().defaultNow());
            })
        );
    }

    down(m: Builder) {
        m.run(op.table('posts').drop());
    }
}
