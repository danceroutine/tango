import { NextAdapter } from '@danceroutine/tango-adapters-next';
import { PostDetailAPIView } from '@/views/index';

const adapter = new NextAdapter();

export const { GET, POST, PATCH, PUT, DELETE } = adapter.adaptGenericAPIView(new PostDetailAPIView());
