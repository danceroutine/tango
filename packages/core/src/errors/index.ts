/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */

import type { HttpError } from './HttpError';
import * as factories from './factories/index';
import { TangoError, type ErrorDetails, type ErrorEnvelope, type ProblemDetails } from './TangoError';
import { ConflictError } from './ConflictError';
import { ValidationError } from './ValidationError';
import { NotFoundError } from './NotFoundError';
import { PermissionDenied } from './PermissionDenied';
import { AuthenticationError } from './AuthenticationError';
import { HttpErrorFactory, type HttpErrorFactoryConfig } from './factories/HttpErrorFactory';

export {
    AuthenticationError,
    ConflictError,
    HttpErrorFactory,
    NotFoundError,
    PermissionDenied,
    TangoError,
    ValidationError,
    factories,
};

export type { ErrorDetails, ErrorEnvelope, HttpError, HttpErrorFactoryConfig, ProblemDetails };
