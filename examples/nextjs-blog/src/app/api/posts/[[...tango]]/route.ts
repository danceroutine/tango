import { NextAdapter } from '@danceroutine/tango-adapters-next';
import { PostViewSet } from '@/viewsets/PostViewSet';

const adapter = new NextAdapter();
export const { GET, POST, PATCH, PUT, DELETE } = adapter.adaptViewSet(new PostViewSet());
