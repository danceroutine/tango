import type { Field } from '../../domain/index';

export interface FinalizedStorageModel {
    key: string;
    table: string;
    fields: readonly Field[];
    pk: string;
}

export interface FinalizedStorageArtifacts {
    version: number;
    byModel: ReadonlyMap<string, FinalizedStorageModel>;
}
