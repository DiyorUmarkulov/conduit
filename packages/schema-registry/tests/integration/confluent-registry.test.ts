import { describe, expect, it } from "vitest";

import { ConfluentSchemaRegistry } from "../../src/confluent-registry.js";
import type { HttpClient } from "../../src/confluent-registry.js";

const registryUrl = process.env.CONDUIT_SCHEMA_REGISTRY_URL;
const shouldRun = Boolean(registryUrl);
const describeIf = shouldRun ? describe : describe.skip;

const createHttpClient = (baseUrl: string): HttpClient => ({
  get: async <T>(path: string): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(`Schema registry GET ${path} failed: ${response.status}`);
    }
    return (await response.json()) as T;
  },
  post: async <T>(path: string, body: unknown): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/vnd.schemaregistry.v1+json"
        },
        body: JSON.stringify(body)
      }
    );
    if (!response.ok) {
      throw new Error(`Schema registry POST ${path} failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }
});

describeIf("ConfluentSchemaRegistry integration", () => {
  it("registers and fetches schema", async () => {
    if (!registryUrl) {
      return;
    }

    const http = createHttpClient(registryUrl);
    const registry = new ConfluentSchemaRegistry(http);

    const subject = `conduit.test.${Date.now()}`;
    const schema = {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" }
      }
    };

    const registered = await registry.register({
      subject,
      format: "JSON_SCHEMA",
      schema
    });

    expect(registered.subject).toBe(subject);
    expect(registered.id).toBeDefined();

    const latest = await registry.getLatest(subject);
    expect(latest?.subject).toBe(subject);
    expect(latest?.schema).toEqual(schema);

    if (registered.id) {
      const byId = await registry.getById?.(registered.id);
      expect(byId?.schema).toEqual(schema);
    }
  });
});
