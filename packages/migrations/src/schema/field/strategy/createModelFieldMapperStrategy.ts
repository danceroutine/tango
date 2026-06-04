import type { Dialect } from '../../../domain/Dialect';
import { InternalDialect } from '../../../domain/internal/InternalDialect';
import { ModelFieldMapperStrategy } from './ModelFieldMapperStrategy';
import { PostgresModelFieldMapperStrategy } from './PostgresModelFieldMapperStrategy';
import { SqliteModelFieldMapperStrategy } from './SqliteModelFieldMapperStrategy';

export function createModelFieldMapperStrategy(dialect?: Dialect): ModelFieldMapperStrategy {
    switch (dialect) {
        case undefined:
        case InternalDialect.SQLITE:
            return new SqliteModelFieldMapperStrategy();
        case InternalDialect.POSTGRES:
            return new PostgresModelFieldMapperStrategy();
    }
}
