import type {
  ISchemaRegistry,
  RegisterSchemaInput,
  RegisteredSchema
} from "./registry.js";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class LocalSchemaRegistry implements ISchemaRegistry {
  private readonly bySubject = new Map<string, RegisteredSchema[]>();

  public async register(input: RegisterSchemaInput): Promise<RegisteredSchema> {
    const current = this.bySubject.get(input.subject) ?? [];
    const version = current.length + 1;

    const schema: RegisteredSchema = {
      subject: input.subject,
      version,
      format: input.format,
      schema: clone(input.schema),
      created_at: new Date().toISOString()
    };

    current.push(schema);
    this.bySubject.set(input.subject, current);

    return clone(schema);
  }

  public async get(
    subject: string,
    version: number
  ): Promise<RegisteredSchema | undefined> {
    const entries = this.bySubject.get(subject) ?? [];
    const found = entries.find((entry) => entry.version === version);
    return found ? clone(found) : undefined;
  }

  public async getLatest(subject: string): Promise<RegisteredSchema | undefined> {
    const entries = this.bySubject.get(subject) ?? [];
    const latest = entries[entries.length - 1];
    return latest ? clone(latest) : undefined;
  }

  public async list(subject: string): Promise<RegisteredSchema[]> {
    return (this.bySubject.get(subject) ?? []).map((entry) => clone(entry));
  }
}
