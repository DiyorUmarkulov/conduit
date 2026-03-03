export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;

export type Priority = (typeof PRIORITIES)[number];

export const isPriority = (value: unknown): value is Priority =>
  typeof value === "string" && (PRIORITIES as readonly string[]).includes(value);
