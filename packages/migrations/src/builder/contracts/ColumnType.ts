import type { InternalColumnType } from '../../domain/internal/InternalColumnType';

export type ColumnType = (typeof InternalColumnType)[keyof typeof InternalColumnType];
