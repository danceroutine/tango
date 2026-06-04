import type { Field } from '@danceroutine/tango-schema/domain';
import type { ColumnType } from '../../../builder/contracts/ColumnType';
import { InternalColumnType } from '../../../domain/internal/InternalColumnType';
import { ModelFieldMapperStrategy } from './ModelFieldMapperStrategy';

export class PostgresModelFieldMapperStrategy extends ModelFieldMapperStrategy {
    protected override mapType(field: Field): ColumnType {
        // Postgres auto-incrementing primary keys are modeled as serial in migrations,
        // while SQLite must preserve the schema-level integer type to avoid churn.
        if (field.primaryKey && field.type === InternalColumnType.INT) {
            return InternalColumnType.SERIAL;
        }

        return super.mapType(field);
    }
}
