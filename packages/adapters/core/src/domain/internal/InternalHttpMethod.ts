export const InternalHttpMethod = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    PATCH: 'PATCH',
    DELETE: 'DELETE',
} as const;

export type HttpMethod = (typeof InternalHttpMethod)[keyof typeof InternalHttpMethod];
