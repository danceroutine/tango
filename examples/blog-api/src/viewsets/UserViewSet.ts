import { FilterSet, ModelViewSet } from '@danceroutine/tango-resources';
import type { RequestContext } from '@danceroutine/tango-resources';
import type { TangoResponse } from '@danceroutine/tango-core';
import type { User } from '../models/index';
import { UserSerializer } from '../serializers/index';
/**
 * Viewset for the user resource.
 *
 * A viewset groups the standard HTTP actions for one resource into a single
 * class. If you are coming from an Express or Next.js background, you can think
 * of it as a structured alternative to writing one route handler per CRUD
 * action. The serializer owns the request and response contract, the model
 * manager supplies persistence behavior, and the adapter turns this class into
 * concrete HTTP routes.
 */
export class UserViewSet extends ModelViewSet<User, typeof UserSerializer> {
    static readonly actions = ModelViewSet.defineViewSetActions([
        {
            name: 'activateAccount',
            scope: 'detail',
            methods: ['POST'],
            path: 'activate-account',
        },
    ]);

    /**
     * Configure the user resource contract.
     */
    constructor() {
        super({
            serializer: UserSerializer,
            filters: FilterSet.define<User>({
                fields: {
                    email: true,
                    username: true,
                },
                aliases: {
                    q: { fields: ['email', 'username'], lookup: 'icontains' },
                },
            }),
            orderingFields: ['id', 'createdAt', 'username'],
            searchFields: ['email', 'username'],
        });
    }

    /**
     * Example custom detail action.
     */
    async activateAccount(_ctx: RequestContext, id: string): Promise<TangoResponse> {
        return this.retrieve(_ctx, id);
    }
}
