import { createOpenAPISpec } from '@/lib/openapi';

export async function GET(): Promise<Response> {
    return Response.json(createOpenAPISpec());
}
