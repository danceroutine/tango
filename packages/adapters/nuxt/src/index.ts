/**
 * Bundled exports for Django-style domain drill-down imports, plus curated
 * top-level symbols for TS-native ergonomic imports.
 */
export * as adapter from './adapter/index';

export {
    NuxtAdapter,
    type AdaptNuxtOptions,
    type AdaptNuxtViewSetOptions,
    type NuxtAPIView,
    type NuxtAPIViewFactory,
    type NuxtCrudViewSet,
    type NuxtEventHandler,
    type NuxtQueryRecord,
    type NuxtViewSetFactory,
    toNuxtQueryParams,
} from './adapter/index';
