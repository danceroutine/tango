import { hasTag } from '../internal/hasTag';

/**
 * Return true when a value is a readable web stream.
 */
export function isReadableStream(value: unknown): value is ReadableStream<Uint8Array<ArrayBuffer>> {
    return hasTag(value, 'ReadableStream');
}
