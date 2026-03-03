import { describe, expect, it } from "vitest";

import { matchOperationPattern, patternSpecificity } from "../../../src/router/route-matcher.js";

describe("route matcher", () => {
  it("matches wildcard patterns", () => {
    expect(matchOperationPattern("order.*", "order.created")).toBe(true);
    expect(matchOperationPattern("order.*", "payment.failed")).toBe(false);
  });

  it("calculates pattern specificity", () => {
    expect(patternSpecificity("order.create")).toBeGreaterThan(
      patternSpecificity("order.*")
    );
  });
});
