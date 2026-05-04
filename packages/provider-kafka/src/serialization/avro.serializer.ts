import type { OperationEnvelope, ProviderDispatchRequest } from "@conduit/core";
import { asOperationName } from "@conduit/core";
import type { ISchemaRegistry } from "@conduit/schema-registry";
import { Type } from "avsc";

export interface ConduitKafkaAvroMessage<TPayload = unknown> {
  envelope: OperationEnvelope<TPayload>;
  handler_id: string;
  emitted_at: string;
}

export interface ConduitAvroSerializerOptions {
  registry: ISchemaRegistry;
  subject: (request: ProviderDispatchRequest) => string;
  schema?: object | string | ((request: ProviderDispatchRequest) => object | string);
  auto_register?: boolean;
}

interface ConduitAvroRecord {
  operation_id: string;
  operation_type: "COMMAND" | "EVENT";
  operation_name: string;
  schema_version: string;
  payload_json: string;
  metadata_json: string;
  created_at: string;
  expires_at?: string | null;
  handler_id: string;
  emitted_at: string;
}

const DEFAULT_AVRO_SCHEMA = {
  type: "record",
  name: "ConduitMessage",
  namespace: "conduit",
  fields: [
    { name: "operation_id", type: "string" },
    {
      name: "operation_type",
      type: {
        type: "enum",
        name: "OperationType",
        symbols: ["COMMAND", "EVENT"]
      }
    },
    { name: "operation_name", type: "string" },
    { name: "schema_version", type: "string" },
    { name: "payload_json", type: "string" },
    { name: "metadata_json", type: "string" },
    { name: "created_at", type: "string" },
    { name: "expires_at", type: ["null", "string"], default: null },
    { name: "handler_id", type: "string" },
    { name: "emitted_at", type: "string" }
  ]
} as const;

const toSchemaObject = (schema: object | string): object =>
  typeof schema === "string" ? (JSON.parse(schema) as object) : schema;

const toSchemaKey = (schema: object | string): string =>
  typeof schema === "string" ? schema : JSON.stringify(schema);

const toAvroRecord = (request: ProviderDispatchRequest): ConduitAvroRecord => ({
  operation_id: request.envelope.operation_id,
  operation_type: request.envelope.operation_type,
  operation_name: request.envelope.operation_name,
  schema_version: request.envelope.schema_version,
  payload_json: JSON.stringify(request.envelope.payload ?? null),
  metadata_json: JSON.stringify(request.envelope.metadata ?? {}),
  created_at: request.envelope.created_at,
  expires_at: request.envelope.expires_at ?? null,
  handler_id: request.handler.id,
  emitted_at: new Date().toISOString()
});

const fromAvroRecord = (record: ConduitAvroRecord): ConduitKafkaAvroMessage => {
  const payload = JSON.parse(record.payload_json);
  const metadata = JSON.parse(record.metadata_json) as OperationEnvelope["metadata"];

  return {
    envelope: {
      operation_id: record.operation_id,
      operation_type: record.operation_type,
      operation_name: asOperationName(record.operation_name),
      schema_version: record.schema_version,
      payload,
      metadata,
      created_at: record.created_at,
      ...(record.expires_at ? { expires_at: record.expires_at } : {})
    },
    handler_id: record.handler_id,
    emitted_at: record.emitted_at
  };
};

const encodeHeader = (schemaId: number): Uint8Array => {
  const header = Buffer.alloc(5);
  header.writeUInt8(0, 0);
  header.writeUInt32BE(schemaId, 1);
  return header;
};

const decodeHeader = (
  payload: Uint8Array
): { schema_id: number; body: Uint8Array } => {
  if (payload.length < 5) {
    throw new Error("Invalid Avro payload: too short");
  }

  const magic = payload[0];
  if (magic !== 0) {
    throw new Error("Invalid Avro payload: missing Confluent magic byte");
  }

  const schemaId = Buffer.from(payload).readUInt32BE(1);
  return {
    schema_id: schemaId,
    body: payload.subarray(5)
  };
};

export class ConduitAvroSerializer {
  private readonly registry: ISchemaRegistry;
  private readonly subjectResolver: (request: ProviderDispatchRequest) => string;
  private readonly schemaResolver: (request: ProviderDispatchRequest) => object | string;
  private readonly autoRegister: boolean;
  private readonly schemaIdCache = new Map<string, number>();
  private readonly typeCache = new Map<number, Type>();

  public constructor(options: ConduitAvroSerializerOptions) {
    this.registry = options.registry;
    this.subjectResolver = options.subject;
    this.schemaResolver =
      typeof options.schema === "function"
        ? (options.schema as (request: ProviderDispatchRequest) => object | string)
        : () => options.schema ?? DEFAULT_AVRO_SCHEMA;
    this.autoRegister = options.auto_register ?? true;
  }

  public async serialize(request: ProviderDispatchRequest): Promise<Uint8Array> {
    const subject = this.subjectResolver(request);
    const schema = this.schemaResolver(request);
    const schemaKey = `${subject}:${toSchemaKey(schema)}`;

    let schemaId = this.schemaIdCache.get(schemaKey);

    if (schemaId === undefined) {
      schemaId = await this.resolveSchemaId(subject, schema);
      this.schemaIdCache.set(schemaKey, schemaId);
    }

    const type = this.getOrCreateType(schemaId, schema);
    const record = toAvroRecord(request);
    const encoded = type.toBuffer(record);

    return Buffer.concat([Buffer.from(encodeHeader(schemaId)), encoded]);
  }

  public async deserialize(payload: Uint8Array): Promise<ConduitKafkaAvroMessage> {
    const { schema_id, body } = decodeHeader(payload);
    const type = await this.getOrLoadType(schema_id);
    const record = type.fromBuffer(Buffer.from(body)) as ConduitAvroRecord;
    return fromAvroRecord(record);
  }

  private async resolveSchemaId(
    subject: string,
    schema: object | string
  ): Promise<number> {
    if (this.autoRegister) {
      const registered = await this.registry.register({
        subject,
        format: "AVRO",
        schema
      });

      if (registered.id === undefined) {
        throw new Error("Schema registry did not return schema id");
      }

      return registered.id;
    }

    const latest = await this.registry.getLatest(subject);
    if (!latest || latest.id === undefined) {
      throw new Error(`Schema registry has no schema for subject ${subject}`);
    }

    return latest.id;
  }

  private getOrCreateType(schemaId: number, schema: object | string): Type {
    const cached = this.typeCache.get(schemaId);
    if (cached) {
      return cached;
    }

    const type = Type.forSchema(
      toSchemaObject(schema) as Parameters<typeof Type.forSchema>[0]
    );
    this.typeCache.set(schemaId, type);
    return type;
  }

  private async getOrLoadType(schemaId: number): Promise<Type> {
    const cached = this.typeCache.get(schemaId);
    if (cached) {
      return cached;
    }

    if (!this.registry.getById) {
      throw new Error("Schema registry does not support getById");
    }

    const entry = await this.registry.getById(schemaId);
    if (!entry) {
      throw new Error(`Schema registry has no schema for id ${schemaId}`);
    }

    const type = Type.forSchema(
      toSchemaObject(entry.schema as object | string) as Parameters<
        typeof Type.forSchema
      >[0]
    );
    this.typeCache.set(schemaId, type);
    return type;
  }
}

export const createConduitAvroSerializer = (
  options: ConduitAvroSerializerOptions
): ((request: ProviderDispatchRequest) => Promise<Uint8Array>) => {
  const serializer = new ConduitAvroSerializer(options);
  return (request) => serializer.serialize(request);
};
