import type { FieldType } from './FieldType';
import type { DeleteReferentialAction } from './DeleteReferentialAction';
import type { UpdateReferentialAction } from './UpdateReferentialAction';

export interface Field {
    name: string;
    type: FieldType;
    notNull?: boolean;
    default?: string | { now: true } | null;
    primaryKey?: boolean;
    unique?: boolean;
    references?: {
        table: string;
        column: string;
        onDelete?: DeleteReferentialAction;
        onUpdate?: UpdateReferentialAction;
    };
    renameFrom?: string;
}
