import type { Direction } from '.';

export interface OrderSpec<T> {
    by: keyof T;
    dir: Direction;
}
