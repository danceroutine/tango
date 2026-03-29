import type { InternalDirection } from './internal/InternalDirection';

export type Direction = (typeof InternalDirection)[keyof typeof InternalDirection];
