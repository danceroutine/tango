import type { FilterKey } from './FilterKey';
import type { FilterValue } from './FilterValue';

export type FilterInput<T> = Partial<Record<FilterKey<T>, FilterValue>>;
