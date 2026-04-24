/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */

export {
    Serializer,
    type SerializerClass,
    type AnySerializerClass,
    type SerializerCreateInput,
    type SerializerOutputResolver,
    type SerializerOutputResolvers,
    type SerializerUpdateInput,
    type SerializerOutput,
    type SerializerSchema,
} from './Serializer';
export {
    ModelSerializer,
    type ModelSerializerClass,
    type AnyModelSerializer,
    type AnyModelSerializerClass,
} from './ModelSerializer';
export {
    relation,
    type ModelSerializerRelationFields,
    type ManyToManyManagerKeys,
    type ManyToManyRelationField,
    type ManyToManyReadStrategy,
    type ManyToManyWriteStrategy,
} from './relation';
