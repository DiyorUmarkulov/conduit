import type { DLQEntry } from "./dlq-entry.js";

export interface DLQFilter {
  operation_name?: string;
  handler_id?: string;
}

export interface IDLQManager {
  put(entry: DLQEntry): Promise<void>;
  list(filter?: DLQFilter): Promise<DLQEntry[]>;
  remove(entryId: string): Promise<void>;
}
