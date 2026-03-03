import { describe, expect, it } from "vitest";

import { LocalSchemaRegistry } from "../../src/local-registry.js";

describe("LocalSchemaRegistry", () => {
  it("registers and fetches latest schema", async () => {
    const registry = new LocalSchemaRegistry();

    await registry.register({
      subject: "order.create",
      format: "JSON_SCHEMA",
      schema: {
        type: "object"
      }
    });

    const latest = await registry.getLatest("order.create");

    expect(latest?.version).toBe(1);
    expect(latest?.subject).toBe("order.create");
  });
});
