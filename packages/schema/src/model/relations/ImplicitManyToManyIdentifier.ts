import { createHash } from 'node:crypto';

/**
 * Single source of truth for identity of Tango-synthesized many-to-many
 * through models. Other parts of the schema package interact with synthesized
 * models exclusively through this class so they do not have to know the
 * namespace or digest scheme those keys encode.
 */
export class ImplicitManyToManyIdentifier {
    private static readonly NAMESPACE = 'tango.implicit';

    /**
     * Stable model key for the synthesized through model connecting
     * `sourceModelKey` to `targetModelKey` via the schema field
     * `sourceSchemaFieldKey`.
     *
     * The returned key is deterministic across runs so storage and hydration
     * artifacts stay stable as long as the inputs match.
     */
    static getModelKey(sourceModelKey: string, sourceSchemaFieldKey: string, targetModelKey: string): string {
        const digest = ImplicitManyToManyIdentifier.digest(sourceModelKey, sourceSchemaFieldKey, targetModelKey, 32);
        return `${ImplicitManyToManyIdentifier.NAMESPACE}/m2m_${digest}`;
    }

    /**
     * Deterministic short digest used to derive the physical join-table name
     * for a synthesized through model. Shorter than the model-key digest so
     * table names stay within common SQL identifier limits.
     */
    static getTableBaseDigest(sourceModelKey: string, sourceSchemaFieldKey: string, targetModelKey: string): string {
        return ImplicitManyToManyIdentifier.digest(sourceModelKey, sourceSchemaFieldKey, targetModelKey, 16);
    }

    /**
     * True when `modelKey` was produced by {@link getModelKey} and therefore
     * identifies a synthesized through model. Callers use this instead of
     * comparing namespace prefixes so the namespace remains an implementation
     * detail of this class.
     */
    static isImplicitManyToManyModel(modelKey: string): boolean {
        return modelKey.startsWith(`${ImplicitManyToManyIdentifier.NAMESPACE}/`);
    }

    /**
     * Namespace under which synthesized through models are registered.
     * Exposed so {@link ImplicitManyToManyThroughFactory} can construct the
     * model with the correct namespace. External callers that want to ask
     * "is this an implicit model" should prefer {@link isImplicitManyToManyModel}.
     */
    static getNamespace(): string {
        return ImplicitManyToManyIdentifier.NAMESPACE;
    }

    /**
     * Extract the `m2m_<digest>` component of a synthesized model key so the
     * factory can register the through model with a deterministic name while
     * keeping the namespace owned by this class.
     */
    static getModelName(modelKey: string): string {
        const prefix = `${ImplicitManyToManyIdentifier.NAMESPACE}/`;
        if (!modelKey.startsWith(prefix)) {
            throw new Error(
                `ImplicitManyToManyIdentifier.getModelName expected a key produced by getModelKey, received '${modelKey}'.`
            );
        }
        return modelKey.slice(prefix.length);
    }

    private static digest(
        sourceModelKey: string,
        sourceSchemaFieldKey: string,
        targetModelKey: string,
        byteLength: number
    ): string {
        return createHash('sha256')
            .update(`${sourceModelKey}\0${sourceSchemaFieldKey}\0${targetModelKey}`, 'utf8')
            .digest('hex')
            .slice(0, byteLength);
    }
}
