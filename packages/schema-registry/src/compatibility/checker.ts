export const COMPATIBILITY_MODES = ["NONE", "BACKWARD", "FULL"] as const;

export type CompatibilityMode = (typeof COMPATIBILITY_MODES)[number];

export interface CompatibilityResult {
  compatible: boolean;
  reasons: string[];
}

const getRequiredKeys = (schema: unknown): Set<string> => {
  if (!schema || typeof schema !== "object") {
    return new Set();
  }

  const required = (schema as { required?: unknown }).required;

  if (!Array.isArray(required)) {
    return new Set();
  }

  return new Set(required.filter((value): value is string => typeof value === "string"));
};

export const checkCompatibility = (
  previousSchema: unknown,
  nextSchema: unknown,
  mode: CompatibilityMode
): CompatibilityResult => {
  if (mode === "NONE") {
    return {
      compatible: true,
      reasons: []
    };
  }

  const previousRequired = getRequiredKeys(previousSchema);
  const nextRequired = getRequiredKeys(nextSchema);

  const reasons: string[] = [];

  for (const key of previousRequired) {
    if (!nextRequired.has(key)) {
      reasons.push(`required field removed: ${key}`);
    }
  }

  if (mode === "FULL") {
    for (const key of nextRequired) {
      if (!previousRequired.has(key)) {
        reasons.push(`new required field added: ${key}`);
      }
    }
  }

  return {
    compatible: reasons.length === 0,
    reasons
  };
};
