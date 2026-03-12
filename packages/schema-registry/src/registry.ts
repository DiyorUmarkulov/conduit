export const SCHEMA_FORMATS = ["JSON_SCHEMA", "PROTOBUF", "AVRO"] as const;

export type SchemaFormat = (typeof SCHEMA_FORMATS)[number];

export interface RegisteredSchema {
  id?: number;
  subject: string;
  version: number;
  format: SchemaFormat;
  schema: unknown;
  created_at: string;
}

export interface RegisterSchemaInput {
  subject: string;
  format: SchemaFormat;
  schema: unknown;
}

export interface ISchemaRegistry {
  register(input: RegisterSchemaInput): Promise<RegisteredSchema>;
  get(subject: string, version: number): Promise<RegisteredSchema | undefined>;
  getLatest(subject: string): Promise<RegisteredSchema | undefined>;
  getById?(id: number): Promise<RegisteredSchema | undefined>;
  list(subject: string): Promise<RegisteredSchema[]>;
}
