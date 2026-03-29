export type GenericModelFactory<TInput extends Record<string, unknown> = Record<string, unknown>, TOutput = TInput> = {
    create(data: TInput): TOutput;
    parse(data: unknown): TOutput;
};

/**
 * Factory class for generating test data with sequences and defaults.
 */
export class ModelDataFactory<TModel extends GenericModelFactory<Record<string, unknown>, unknown>> {
    private sequence = 0;

    constructor(
        private model: TModel,
        private defaults: Partial<Parameters<TModel['create']>[0]> = {}
    ) {}

    /**
     * Build one model instance by merging defaults, sequence defaults, and overrides.
     */
    public build(overrides: Partial<Parameters<TModel['create']>[0]> = {}): ReturnType<TModel['create']> {
        this.sequence++;
        const data = {
            ...this.defaults,
            ...this.sequenceDefaults(),
            ...overrides,
        };
        return this.model.create(data as Parameters<TModel['create']>[0]) as ReturnType<TModel['create']>;
    }

    /**
     * Build `count` model instances using shared overrides.
     */
    public buildList(
        count: number,
        overrides: Partial<Parameters<TModel['create']>[0]> = {}
    ): ReturnType<TModel['create']>[] {
        return Array.from({ length: count }, () => this.build(overrides));
    }

    /**
     * Reset the internal sequence counter to zero.
     */
    public resetSequence(): void {
        this.sequence = 0;
    }

    /**
     * Return the current sequence counter value.
     */
    public getSequence(): number {
        return this.sequence;
    }

    /**
     * Hook for subclasses to provide per-sequence default values.
     */
    protected sequenceDefaults(): Partial<Parameters<TModel['create']>[0]> {
        return {};
    }
}
