import { NuxtAdapter } from '@danceroutine/tango-adapters-nuxt';
import { PostViewSet } from '~~/viewsets/PostViewSet';

const adapter = new NuxtAdapter();

export default adapter.adaptViewSet(new PostViewSet());
