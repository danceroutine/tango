/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */

export type { FrameworkAdapter, FrameworkAdapterOptions } from './FrameworkAdapter';
export { FRAMEWORK_ADAPTER_BRAND, isFrameworkAdapter } from './FrameworkAdapter';
export type { FrameworkTransactionPolicy } from './internal/InternalFrameworkTransactionPolicy';
export {
    BoundFrameworkAdapterRequestExecutor,
    FrameworkAdapterRequestExecutor,
    type MaterializedTangoResponse,
} from './internal/FrameworkAdapterRequestExecutor';
