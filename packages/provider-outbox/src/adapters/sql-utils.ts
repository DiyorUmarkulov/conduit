export const SAFE_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_$.]*$/;

export const assertSafeIdentifier = (value: string, name: string): string => {
  if (!SAFE_IDENTIFIER_RE.test(value)) {
    throw new Error(`Invalid ${name}: ${value}`);
  }

  return value;
};

export const placeholders = (count: number): string =>
  new Array(Math.max(0, count)).fill("?").join(", ");

export const asRows = <T>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  return [];
};

export const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;
