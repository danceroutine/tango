import type { InternalRelationType } from './internal/InternalRelationType';

export type RelationType = (typeof InternalRelationType)[keyof typeof InternalRelationType];
