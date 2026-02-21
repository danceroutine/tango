import { ModelSerializer } from '@danceroutine/tango-resources';
import { UserCreateSchema, UserModel, UserReadSchema, UserUpdateSchema, type User } from '../models/index';

export class UserSerializer extends ModelSerializer<
    User,
    typeof UserCreateSchema,
    typeof UserUpdateSchema,
    typeof UserReadSchema
> {
    static readonly model = UserModel;
    static readonly createSchema = UserCreateSchema;
    static readonly updateSchema = UserUpdateSchema;
    static readonly outputSchema = UserReadSchema;
}
