import { isNil } from '../object/isNil';

export function hasTag(value: unknown, tag: string): boolean {
    return !isNil(value) && Object.prototype.toString.call(value) === `[object ${tag}]`;
}
