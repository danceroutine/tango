/**
 * Bundled exports for Django-style domain drill-down imports, plus curated
 * top-level symbols for TS-native ergonomic imports.
 */
export * as adapter from './adapter/index';

export {
    NextAdapter,
    type AdaptNextOptions,
    type AdaptNextViewSetOptions,
    type NextAPIView,
    type NextAPIViewFactory,
    type NextCrudViewSet,
    type NextDynamicRouteContext,
    type NextDynamicRouteHandler,
    type NextRouteHandler,
    type NextViewSetFactory,
    type NextViewSetRouteHandlers,
} from './adapter/index';
