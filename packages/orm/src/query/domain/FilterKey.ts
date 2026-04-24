import type { LookupType } from './LookupType';

type ScalarFilterKey<T> = Extract<keyof T, string> | `${Extract<keyof T, string>}__${LookupType}`;

export type FilterKey<T, _TSourceModel = unknown> = ScalarFilterKey<T> | string;
