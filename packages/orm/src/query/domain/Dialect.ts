import type { InternalDialect } from './internal/InternalDialect';

export type Dialect = (typeof InternalDialect)[keyof typeof InternalDialect];
