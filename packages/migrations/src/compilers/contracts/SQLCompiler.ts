import type { MigrationOperation } from '../../domain/MigrationOperation';
import type { SQL } from './SQL';

/**
 * Contract for dialect-specific migration SQL compilers.
 */
export interface SQLCompiler {
    /** Compile an operation into SQL statements. */
    compile(operation: MigrationOperation): SQL[];
}
