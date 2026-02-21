import type { TrustedSqlFragment } from '@danceroutine/tango-core';
import type { ColumnType } from './ColumnType';
import type { DeleteReferentialAction } from './DeleteReferentialAction';
import type { UpdateReferentialAction } from './UpdateReferentialAction';

export interface ColumnSpec {
    name: string;
    type: ColumnType;
    notNull?: boolean;
    default?: TrustedSqlFragment | { now: true } | null;
    primaryKey?: boolean;
    unique?: boolean;
    references?: {
        table: string;
        column: string;
        onDelete?: DeleteReferentialAction;
        onUpdate?: UpdateReferentialAction;
    };
}
