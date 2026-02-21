/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */

export { APIView, type APIViewMethod } from './APIView';
export { GenericAPIView, type GenericAPIViewConfig } from './GenericAPIView';
export type { GenericAPIViewOpenAPIDescription } from '../resource/index';
export {
    ListModelMixin,
    CreateModelMixin,
    RetrieveModelMixin,
    UpdateModelMixin,
    DestroyModelMixin,
} from './mixins/index';
export {
    ListAPIView,
    CreateAPIView,
    RetrieveAPIView,
    ListCreateAPIView,
    RetrieveUpdateAPIView,
    RetrieveDestroyAPIView,
    RetrieveUpdateDestroyAPIView,
} from './generics/index';
