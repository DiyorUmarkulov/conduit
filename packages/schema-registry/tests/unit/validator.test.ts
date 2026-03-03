import { describe, expect, it } from "vitest";

import { validateJsonSchema } from "../../src/validator.js";

describe("validateJsonSchema", () => {
  it("validates required fields", () => {
    const schema = {
      type: "object",
      required: ["id"],
      properties: {
        id: {
          type: "string"
        }
      }
    };

    const ok = validateJsonSchema(schema, {
      id: "x"
    });

    const bad = validateJsonSchema(schema, {});

    expect(ok.valid).toBe(true);
    expect(bad.valid).toBe(false);
    expect(bad.errors[0]).toContain("id");
  });
});
