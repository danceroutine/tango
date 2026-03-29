export type OrderToken<T> = keyof T | `-${string & keyof T}`;
