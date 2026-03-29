import type { LookupType } from '.';

export type FilterKey<T> = keyof T | `${string & keyof T}__${LookupType}`;
