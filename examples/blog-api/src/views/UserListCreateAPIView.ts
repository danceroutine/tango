import { FilterSet, ListCreateAPIView } from '@danceroutine/tango-resources';
import { type User } from '../models/index';
import { UserSerializer } from '../serializers/index';

/**
 * GenericAPIView example backed by a Tango model serializer.
 */
export class UserListCreateAPIView extends ListCreateAPIView<User, typeof UserSerializer> {
    constructor() {
        super({
            serializer: UserSerializer,
            filters: FilterSet.define<User>({
                fields: {
                    email: true,
                    username: true,
                },
            }),
            orderingFields: ['id', 'createdAt', 'username'],
            searchFields: ['email', 'username'],
        });
    }
}
