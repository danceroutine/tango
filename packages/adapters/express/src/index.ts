/**
 * Bundled exports for Django-style domain drill-down imports, plus curated
 * top-level symbols for TS-native ergonomic imports.
 */
export * as adapter from './adapter/index';

export {
    ExpressAdapter,
    type AdaptExpressOptions,
    type ExpressAPIView,
    type ExpressCrudViewSet,
    type ExpressRouteRegistrar,
} from './adapter/index';
