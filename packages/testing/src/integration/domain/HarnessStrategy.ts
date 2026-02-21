import type { Dialect } from './Dialect';
import type { AdapterConfig } from '@danceroutine/tango-orm';
import type { DialectTestCapabilities } from './IntegrationHarness';
import type { IntegrationHarness } from './IntegrationHarness';
import type { ResetMode } from './ResetMode';

export interface HarnessOptions {
    config?: Partial<AdapterConfig>;
    tangoConfigLoader?: () => unknown;
    resetMode?: ResetMode;
    schema?: string;
    sqliteFile?: string;
}

export interface HarnessStrategy {
    readonly dialect: Dialect | string;
    readonly capabilities: DialectTestCapabilities;
    create(options?: HarnessOptions): Promise<IntegrationHarness>;
}
