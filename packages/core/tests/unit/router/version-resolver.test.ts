import { describe, expect, it } from "vitest";

import { satisfiesSchemaRange } from "../../../src/types/schema.js";

describe("satisfiesSchemaRange", () => {
  it("matches comparator range", () => {
    expect(satisfiesSchemaRange("1.3.0", ">=1.0.0 <2.0.0")).toBe(true);
    expect(satisfiesSchemaRange("2.0.0", ">=1.0.0 <2.0.0")).toBe(false);
  });

  it("matches wildcard range", () => {
    expect(satisfiesSchemaRange("1.5.2", "1.x")).toBe(true);
    expect(satisfiesSchemaRange("2.5.2", "1.x")).toBe(false);
  });
});
