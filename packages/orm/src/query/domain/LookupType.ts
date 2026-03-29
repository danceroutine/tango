import type { InternalLookupType } from './internal/InternalLookupType';

export type LookupType = (typeof InternalLookupType)[keyof typeof InternalLookupType];
