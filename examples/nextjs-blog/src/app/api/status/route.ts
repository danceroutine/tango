import { NextAdapter } from '@danceroutine/tango-adapters-next';
import { StatusAPIView } from '@/views/index';

const adapter = new NextAdapter();

export const { GET } = adapter.adaptAPIView(new StatusAPIView());
