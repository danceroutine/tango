import type { InternalReferentialAction } from '../../domain/internal/InternalReferentialAction';

export type DeleteReferentialAction = (typeof InternalReferentialAction)[keyof typeof InternalReferentialAction];
