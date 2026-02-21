// Import through the package subpath so fixtures stay aligned with the public nominal type.
import { RequestContext, type BaseUser } from '@danceroutine/tango-resources/context';

type RequestContextFactory<TUser, TContext extends RequestContextLike<TUser>> = (
    request: Request,
    user: TUser | null
) => TContext;

type RequestContextLike<TUser> = {
    request: Request;
    user: TUser | null;
    params: Record<string, string>;
};

export type RequestContextFixtureOptions<
    TUser = BaseUser,
    TContext extends RequestContextLike<TUser> = RequestContext<TUser>,
> = {
    method?: string;
    url?: string;
    body?: unknown;
    user?: TUser | null;
    params?: Record<string, string>;
    headers?: HeadersInit;
    contextFactory?: RequestContextFactory<TUser, TContext>;
};

/**
 * Create a RequestContext fixture with optional method/url/body/user/params.
 */
export function aRequestContext<TUser = BaseUser, TContext extends RequestContextLike<TUser> = RequestContext<TUser>>(
    method: string,
    url: string,
    body?: unknown
): TContext;
export function aRequestContext<TUser = BaseUser, TContext extends RequestContextLike<TUser> = RequestContext<TUser>>(
    options?: RequestContextFixtureOptions<TUser, TContext>
): TContext;
export function aRequestContext<TUser = BaseUser, TContext extends RequestContextLike<TUser> = RequestContext<TUser>>(
    optionsOrMethod: RequestContextFixtureOptions<TUser, TContext> | string = {},
    urlArg?: string,
    bodyArg?: unknown
): TContext {
    const resolvedOptions: RequestContextFixtureOptions<TUser, TContext> =
        typeof optionsOrMethod === 'string'
            ? {
                  method: optionsOrMethod,
                  url: urlArg,
                  body: bodyArg,
              }
            : optionsOrMethod;
    const {
        method = 'GET',
        url = 'https://example.test',
        body,
        user = null,
        params = {},
        headers,
        contextFactory,
    } = resolvedOptions;

    const resolvedHeaders: HeadersInit | undefined =
        body === undefined ? headers : { 'content-type': 'application/json', ...headers };

    const request = new Request(url, {
        method,
        headers: resolvedHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const createContext =
        contextFactory ?? ((req: Request, currentUser: TUser | null) => RequestContext.create<TUser>(req, currentUser));
    const context = createContext(request, user) as TContext;
    context.params = params;
    return context;
}
