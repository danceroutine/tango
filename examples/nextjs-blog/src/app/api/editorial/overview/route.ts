import { NextAdapter } from '@danceroutine/tango-adapters-next';
import { EditorialOverviewAPIView } from '@/views';

const adapter = new NextAdapter();

export const { GET } = adapter.adaptAPIView(new EditorialOverviewAPIView());
