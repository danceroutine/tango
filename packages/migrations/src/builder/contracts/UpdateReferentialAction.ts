import type { InternalReferentialAction } from '../../domain/internal/InternalReferentialAction';

export type UpdateReferentialAction = Extract<InternalReferentialAction, 'CASCADE' | 'RESTRICT' | 'NO_ACTION'>;
