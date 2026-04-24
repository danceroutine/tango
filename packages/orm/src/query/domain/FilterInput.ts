import type { FilterKey } from './FilterKey';
import type { FilterValue } from './FilterValue';

export type FilterInput<T, TSourceModel = unknown> = Partial<Record<FilterKey<T, TSourceModel>, FilterValue>>;
