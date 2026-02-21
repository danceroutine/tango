/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */

export type { LoadedConfig } from './LoadedConfig';
export { defineConfig } from './defineConfig';
export { loadConfig } from './loadConfig';
export { loadConfigFromProjectRoot } from './loadConfigFromProjectRoot';
export type { ProjectConfigLoadOptions } from './loadConfigFromProjectRoot';
