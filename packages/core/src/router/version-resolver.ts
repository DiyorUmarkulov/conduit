import type { RegisteredHandler } from "../types/handler.js";
import { satisfiesSchemaRange } from "../types/schema.js";

export const resolveHandlersByVersion = (
  handlers: RegisteredHandler[],
  schemaVersion: string
): RegisteredHandler[] =>
  handlers.filter((handler) => satisfiesSchemaRange(schemaVersion, handler.version_range));
