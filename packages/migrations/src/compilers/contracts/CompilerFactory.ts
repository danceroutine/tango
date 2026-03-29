import type { SQLCompiler } from './SQLCompiler';

/**
 * Factory contract for SQL compiler instances.
 */
export interface CompilerFactory {
    /** Create a compiler instance. */
    create(): SQLCompiler;
}
