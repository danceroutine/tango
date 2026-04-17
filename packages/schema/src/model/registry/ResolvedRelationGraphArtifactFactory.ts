// oxlint-disable unicorn/no-static-only-class
import { createHash } from 'node:crypto';
import type { ResolvedRelationGraph } from '../relations/ResolvedRelationGraph';
import { ResolvedRelationGraphBuilder } from '../relations/ResolvedRelationGraphBuilder';
import type { ResolvedRelationGraphSnapshot } from './ResolvedRelationGraphSnapshot';

/**
 * Build canonical serialized artifacts from a resolved relation graph.
 *
 * Generation, drift detection, and related tooling all need the same stable
 * snapshot shape and fingerprinting rules, so that work lives behind one class
 * instead of a pair of free functions.
 */
export class ResolvedRelationGraphArtifactFactory {
    static createSnapshot(graph: ResolvedRelationGraph): ResolvedRelationGraphSnapshot {
        return ResolvedRelationGraphBuilder.createSnapshot(graph);
    }

    static createFingerprint(value: ResolvedRelationGraph | ResolvedRelationGraphSnapshot): string {
        const snapshot = 'byModel' in value ? ResolvedRelationGraphArtifactFactory.createSnapshot(value) : value;
        return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    }
}
