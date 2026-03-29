/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */

import * as errors from './errors/index';
import * as http from './http/index';
import * as logging from './logging/index';
import * as runtime from './runtime/index';
import * as sql from './sql/index';
import {
    AuthenticationError,
    ConflictError,
    HttpErrorFactory,
    NotFoundError,
    PermissionDenied,
    TangoError,
    ValidationError,
    type ErrorDetails,
    type ErrorEnvelope,
    type HttpError,
    type HttpErrorFactoryConfig,
    type ProblemDetails,
} from './errors/index';
import { TangoBody, type JsonValue, TangoHeaders, TangoQueryParams, TangoRequest, TangoResponse } from './http/index';
import { ConsoleLogger, getLogger, setLoggerFactory, resetLoggerFactory, type Logger } from './logging/index';
import {
    SqlSafetyEngine,
    isTrustedSqlFragment,
    quoteSqlIdentifier,
    trustedSql,
    validateSqlIdentifier,
    type SqlDialect,
    type SqlIdentifierRequest,
    type SqlIdentifierRole,
    type SqlLookupTokenRequest,
    type SqlRawFragmentRequest,
    type SqlSafetyRequest,
    type TrustedSqlFragment,
    type ValidatedSqlIdentifier,
    type ValidatedSqlLookupToken,
    type ValidatedSqlSafetyResult,
} from './sql/index';
import {
    isArrayBuffer,
    isBlob,
    isDate,
    isError,
    isFile,
    isFormData,
    isObject,
    isReadableStream,
    isUint8Array,
    isURLSearchParams,
} from './runtime/index';

/**
 * Bundled exports for Django-style domain drill-down imports, plus curated
 * top-level symbols for TS-native ergonomic imports.
 */
export { errors, http, logging, runtime, sql };

export {
    AuthenticationError,
    ConflictError,
    HttpErrorFactory,
    NotFoundError,
    PermissionDenied,
    TangoBody,
    TangoError,
    TangoHeaders,
    TangoQueryParams,
    TangoRequest,
    TangoResponse,
    ValidationError,
    ConsoleLogger,
    getLogger,
    setLoggerFactory,
    resetLoggerFactory,
    SqlSafetyEngine,
    trustedSql,
    isTrustedSqlFragment,
    validateSqlIdentifier,
    quoteSqlIdentifier,
    isArrayBuffer,
    isBlob,
    isDate,
    isError,
    isFile,
    isFormData,
    isObject,
    isReadableStream,
    isUint8Array,
    isURLSearchParams,
};

export type {
    ErrorDetails,
    ErrorEnvelope,
    HttpError,
    HttpErrorFactoryConfig,
    JsonValue,
    Logger,
    ProblemDetails,
    SqlDialect,
    SqlIdentifierRequest,
    SqlIdentifierRole,
    SqlLookupTokenRequest,
    SqlRawFragmentRequest,
    SqlSafetyRequest,
    TrustedSqlFragment,
    ValidatedSqlIdentifier,
    ValidatedSqlLookupToken,
    ValidatedSqlSafetyResult,
};
