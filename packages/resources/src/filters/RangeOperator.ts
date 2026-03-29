import type { InternalRangeOperator } from './internal/InternalRangeOperator';

export type RangeOperator = (typeof InternalRangeOperator)[keyof typeof InternalRangeOperator];
