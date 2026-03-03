export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

interface JsonSchema {
  type?: "object" | "string" | "number" | "integer" | "boolean" | "array";
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validateType = (value: unknown, type: JsonSchema["type"]): boolean => {
  switch (type) {
    case "object":
      return isObject(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    default:
      return true;
  }
};

const validateNode = (
  schema: JsonSchema,
  payload: unknown,
  path: string,
  errors: string[]
): void => {
  if (schema.type && !validateType(payload, schema.type)) {
    errors.push(`${path} expected ${schema.type}`);
    return;
  }

  if (schema.type === "object" && isObject(payload)) {
    const required = schema.required ?? [];

    for (const key of required) {
      if (!(key in payload)) {
        errors.push(`${path}.${key} is required`);
      }
    }

    const properties = schema.properties ?? {};

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (!(key in payload)) {
        continue;
      }

      validateNode(propertySchema, payload[key], `${path}.${key}`, errors);
    }
  }

  if (schema.type === "array" && Array.isArray(payload) && schema.items) {
    for (let index = 0; index < payload.length; index += 1) {
      validateNode(schema.items, payload[index], `${path}[${index}]`, errors);
    }
  }
};

export const validateJsonSchema = (
  schema: unknown,
  payload: unknown
): SchemaValidationResult => {
  if (!isObject(schema)) {
    return {
      valid: false,
      errors: ["schema must be an object"]
    };
  }

  const errors: string[] = [];
  validateNode(schema as JsonSchema, payload, "$", errors);

  return {
    valid: errors.length === 0,
    errors
  };
};
