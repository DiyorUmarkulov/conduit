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
}

const toConfluentType = (format: SchemaFormat): string => {
  if (format === "PROTOBUF") {
    return "PROTOBUF";
  }

  return "JSON";
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
        subject: response.subject,
        version: response.version,
        format: "JSON_SCHEMA",
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
        subject: response.subject,
        version: response.version,
        format: "JSON_SCHEMA",
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
