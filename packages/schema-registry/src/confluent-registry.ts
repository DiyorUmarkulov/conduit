import type {
  ISchemaRegistry,
  RegisterSchemaInput,
  RegisteredSchema,
  SchemaFormat
} from "./registry.js";

export interface HttpClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}

interface ConfluentSchemaResponse {
  id: number;
  subject: string;
  version: number;
  schema: string;
  schemaType?: string;
}

const toConfluentType = (format: SchemaFormat): string => {
  if (format === "PROTOBUF") {
    return "PROTOBUF";
  }

  if (format === "AVRO") {
    return "AVRO";
  }

  return "JSON";
};

const toSchemaFormat = (schemaType?: string): SchemaFormat => {
  if (schemaType === "PROTOBUF") {
    return "PROTOBUF";
  }

  if (schemaType === "JSON") {
    return "JSON_SCHEMA";
  }

  if (schemaType === "AVRO") {
    return "AVRO";
  }

  return "AVRO";
};

export class ConfluentSchemaRegistry implements ISchemaRegistry {
  public constructor(private readonly http: HttpClient) {}

  public async register(input: RegisterSchemaInput): Promise<RegisteredSchema> {
    const response = await this.http.post<ConfluentSchemaResponse>(
      `/subjects/${encodeURIComponent(input.subject)}/versions`,
      {
        schemaType: toConfluentType(input.format),
        schema:
          typeof input.schema === "string"
            ? input.schema
            : JSON.stringify(input.schema)
      }
    );

    return {
      id: response.id,
      subject: response.subject,
      version: response.version,
      format: input.format,
      schema: JSON.parse(response.schema),
      created_at: new Date().toISOString()
    };
  }

  public async get(
    subject: string,
    version: number
  ): Promise<RegisteredSchema | undefined> {
    try {
      const response = await this.http.get<ConfluentSchemaResponse>(
        `/subjects/${encodeURIComponent(subject)}/versions/${version}`
      );

      return {
        id: response.id,
        subject: response.subject,
        version: response.version,
        format: toSchemaFormat(response.schemaType),
        schema: JSON.parse(response.schema),
        created_at: new Date().toISOString()
      };
    } catch {
      return undefined;
    }
  }

  public async getLatest(subject: string): Promise<RegisteredSchema | undefined> {
    try {
      const response = await this.http.get<ConfluentSchemaResponse>(
        `/subjects/${encodeURIComponent(subject)}/versions/latest`
      );

      return {
        id: response.id,
        subject: response.subject,
        version: response.version,
        format: toSchemaFormat(response.schemaType),
        schema: JSON.parse(response.schema),
        created_at: new Date().toISOString()
      };
    } catch {
      return undefined;
    }
  }

  public async getById(id: number): Promise<RegisteredSchema | undefined> {
    try {
      const response = await this.http.get<ConfluentSchemaResponse>(
        `/schemas/ids/${id}`
      );

      return {
        id,
        subject: String(id),
        version: 0,
        format: toSchemaFormat(response.schemaType),
        schema: JSON.parse(response.schema),
        created_at: new Date().toISOString()
      };
    } catch {
      return undefined;
    }
  }

  public async list(subject: string): Promise<RegisteredSchema[]> {
    const latest = await this.getLatest(subject);
    return latest ? [latest] : [];
  }
}
