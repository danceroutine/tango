/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */

export {
    ModelViewSet,
    type ModelViewSetConfig,
    type ViewSetActionDescriptor,
    type ViewSetActionMethod,
    type ViewSetActionScope,
    type ResolvedViewSetActionDescriptor,
} from './ModelViewSet';
export type { ModelViewSetOpenAPIDescription } from '../resource/index';
