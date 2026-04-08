/**
 * Domain boundary barrel for relation authoring.
 *
 * The relations subdomain has three internal layers:
 *
 * - authoring: `RelationBuilder`
 * - normalization: field-authored relations become normalized descriptors
 * - resolution: normalized descriptors become the registry-scoped relation graph
 *
 * Only the authoring surface is exported here. The later pipeline stages stay
 * internal until Tango intentionally publishes them as supported contracts.
 */
export { RelationBuilder } from './RelationBuilder';
