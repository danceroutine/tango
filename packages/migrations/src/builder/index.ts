/**
 * Domain boundary barrel: exposes namespaced exports for Django-style drill-down
 * imports and curated flat exports for TS-native ergonomics.
 */

export * as contracts from './contracts/index';
export * as ops from './ops/index';
export * as runtime from './runtime/index';

export type {
    Builder,
    ColumnSpec,
    ColumnType,
    DeleteReferentialAction,
    UpdateReferentialAction,
} from './contracts/index';
export { OpBuilder, op, applyFieldType } from './ops/index';
export { CollectingBuilder } from './runtime/index';
