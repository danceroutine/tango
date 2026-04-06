import type { Model } from '../../../domain';

// TODO: consider expanding this to support async model callbacks such as `() => Promise<Model>` when we tackle lazy import boundaries for cyclical model graphs.

export type ModelRef = string | Model | (() => Model);
