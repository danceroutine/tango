export type CodegenFieldMeta = {
    type: string;
    dbType?: string;
    primaryKey?: boolean;
    unique?: boolean;
    nullable?: boolean;
    default?: unknown;
};

export type CodegenModel = {
    name: string;
    fields:
        | Record<string, CodegenFieldMeta>
        | Array<{
              name: string;
              type: string;
              primaryKey?: boolean;
              unique?: boolean;
              notNull?: boolean;
              default?: unknown;
          }>;
};
