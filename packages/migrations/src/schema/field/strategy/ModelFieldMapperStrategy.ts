import type { Field } from '@danceroutine/tango-schema/domain';
import type { ColumnType } from '../../../builder/contracts/ColumnType';
import type { ModelMetadataLike } from '../../../diff/diffSchema';

export class ModelFieldMapperStrategy {
    mapField(field: Field): ModelMetadataLike['fields'][number] {
        return {
            name: field.name,
            type: this.mapType(field),
            notNull: field.notNull,
            default: field.default,
            primaryKey: field.primaryKey,
            unique: field.unique,
            references: field.references as ModelMetadataLike['fields'][number]['references'],
        };
    }

    protected mapType(field: Field): ColumnType {
        return field.type as ColumnType;
    }
}
