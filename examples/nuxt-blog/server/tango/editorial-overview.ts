import { NuxtAdapter } from '@danceroutine/tango-adapters-nuxt';
import { EditorialOverviewAPIView } from '~~/views';

const adapter = new NuxtAdapter();

export default adapter.adaptAPIView(new EditorialOverviewAPIView());
