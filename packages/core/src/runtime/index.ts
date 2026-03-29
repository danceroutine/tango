/**
 * Domain boundary barrel: exposes namespaced exports for Django-style drill-down
 * imports and curated flat exports for TS-native ergonomics.
 */

export * as binary from './binary/index';
export * as web from './web/index';
export * as object from './object/index';
export * as error from './error/index';
export * as date from './date/index';

export { isArrayBuffer, isBlob, isUint8Array } from './binary/index';
export { isFile, isFormData, isReadableStream, isURLSearchParams } from './web/index';
export { isNil, isObject } from './object/index';
export { isError } from './error/index';
export { isDate } from './date/index';
