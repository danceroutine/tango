import type { CodegenModel } from '../../domain';
import { normalizeFields } from '../../mappers';

/**
 * Generate a class-based Tango migration source file from model metadata.
 *
 * The generated migration creates one table per model in `up()` and drops
 * those tables in reverse order in `down()` to keep teardown deterministic.
 */
export function generateMigrationFromModels(models: CodegenModel[]): string {
    const generatedId = `auto_generated_${Date.now()}`;
    const className = `Migration_${generatedId}`;
    const operations = models
        .map((model) => {
            const fields = normalizeFields(model.fields)
                .map(([name, meta]) => {
                    return `      cols.add('${name}', (b) => b.${meta.dbType || meta.type}()${meta.primaryKey ? '.primaryKey()' : ''}${meta.unique ? '.unique()' : ''}${meta.nullable ? '' : '.notNull()'});`;
                })
                .join('\n');

            return `      op.table('${model.name.toLowerCase()}s').create((cols) => {\n${fields}\n      }),`;
        })
        .join('\n\n');
    const reverseOperations = [...models]
        // oxlint-disable-next-line unicorn/no-array-reverse
        .reverse()
        .map((model) => `      op.table('${model.name.toLowerCase()}s').drop(),`)
        .join('\n');

    return `
import { Migration, op, type Builder } from '@danceroutine/tango-migrations';

export default class ${className} extends Migration {
  id = '${generatedId}';

  up(m: Builder) {
    m.run(
${operations}
    );
  }

  down(m: Builder) {
    m.run(
${reverseOperations}
    );
  }
}
  `.trim();
}
