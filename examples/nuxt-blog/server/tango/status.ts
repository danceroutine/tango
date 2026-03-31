import { NuxtAdapter } from '@danceroutine/tango-adapters-nuxt';
import { StatusAPIView } from '~~/views';

const adapter = new NuxtAdapter();

export default adapter.adaptAPIView(new StatusAPIView());
