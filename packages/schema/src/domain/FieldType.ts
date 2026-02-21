import type { InternalFieldType } from './internal/InternalFieldType';

export type FieldType = (typeof InternalFieldType)[keyof typeof InternalFieldType];
