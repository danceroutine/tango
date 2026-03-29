/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */

export {
    Serializer,
    type SerializerClass,
    type AnySerializerClass,
    type SerializerCreateInput,
    type SerializerUpdateInput,
    type SerializerOutput,
    type SerializerSchema,
} from './Serializer';
export { ModelSerializer, type ModelSerializerClass, type AnyModelSerializerClass } from './ModelSerializer';
