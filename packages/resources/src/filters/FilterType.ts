import type { InternalFilterType } from './internal/InternalFilterType';

export type FilterType = (typeof InternalFilterType)[keyof typeof InternalFilterType];
