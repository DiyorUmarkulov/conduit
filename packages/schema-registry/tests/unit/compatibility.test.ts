import { describe, expect, it } from "vitest";

import { checkCompatibility } from "../../src/compatibility/checker.js";
import { diffSchemas } from "../../src/compatibility/diff.js";

describe("schema compatibility", () => {
  it("detects backward incompatible required field removal", () => {
    const previous = {
      type: "object",
      required: ["id", "status"]
    };

    const next = {
      type: "object",
      required: ["id"]
    };

    const result = checkCompatibility(previous, next, "BACKWARD");

    expect(result.compatible).toBe(false);
    expect(result.reasons[0]).toContain("status");
  });

  it("produces schema diff", () => {
    const diff = diffSchemas(
      { a: 1, nested: { x: true } },
      { a: 2, nested: { x: true, y: "new" } }
    );

    expect(diff.added).toContain("nested.y");
    expect(diff.changed).toContain("a");
  });
});
