export const OPERATION_TYPES = ["COMMAND", "EVENT"] as const;

export type OperationType = (typeof OPERATION_TYPES)[number];

export type OperationName = string & {
  readonly __operationNameBrand: unique symbol;
};

export const isOperationType = (value: unknown): value is OperationType =>
  typeof value === "string" &&
  (OPERATION_TYPES as readonly string[]).includes(value);

export const asOperationName = (value: string): OperationName =>
  value as OperationName;
