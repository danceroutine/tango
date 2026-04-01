import { NuxtAdapter } from '@danceroutine/tango-adapters-nuxt';
import { PostDetailAPIView } from '~~/views';

const adapter = new NuxtAdapter();

export default adapter.adaptGenericAPIView(new PostDetailAPIView());
