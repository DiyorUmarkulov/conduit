import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { renderTable } from "../output/table.js";
import type { CliOutput } from "../types.js";

export interface SchemaDiffCommandInput {
  left_file: string;
  right_file: string;
  output: CliOutput;
  cwd?: string;
  json?: boolean;
}

interface DiffChangedRow {
  path: string;
  left: unknown;
  right: unknown;
}

interface SchemaDiffResult {
  added: string[];
  removed: string[];
  changed: DiffChangedRow[];
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const walkDiff = (
  left: unknown,
  right: unknown,
  path: string,
  result: SchemaDiffResult
): void => {
  if (left === right) {
    return;
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);

    for (const key of [...keys].sort()) {
      const nextPath = path ? `${path}.${key}` : key;

      if (!(key in left)) {
        result.added.push(nextPath);
        continue;
      }

      if (!(key in right)) {
        result.removed.push(nextPath);
        continue;
      }

      walkDiff(left[key], right[key], nextPath, result);
    }

    return;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    const maxLength = Math.max(left.length, right.length);

    for (let index = 0; index < maxLength; index += 1) {
      const nextPath = `${path}[${index}]`;

      if (index >= left.length) {
        result.added.push(nextPath);
        continue;
      }

      if (index >= right.length) {
        result.removed.push(nextPath);
        continue;
      }

      walkDiff(left[index], right[index], nextPath, result);
    }

    return;
  }

  result.changed.push({
    path,
    left,
    right
  });
};

export const runSchemaDiffCommand = async ({
  left_file: leftFile,
  right_file: rightFile,
  output,
  cwd = process.cwd(),
  json = false
}: SchemaDiffCommandInput): Promise<number> => {
  const leftPath = resolve(cwd, leftFile);
  const rightPath = resolve(cwd, rightFile);

  try {
    const [leftRaw, rightRaw] = await Promise.all([
      readFile(leftPath, "utf8"),
      readFile(rightPath, "utf8")
    ]);

    const leftParsed = JSON.parse(leftRaw) as unknown;
    const rightParsed = JSON.parse(rightRaw) as unknown;

    const result: SchemaDiffResult = {
      added: [],
      removed: [],
      changed: []
    };

    walkDiff(leftParsed, rightParsed, "", result);

    if (json) {
      output.write(
        JSON.stringify(
          {
            left: leftPath,
            right: rightPath,
            ...result
          },
          null,
          2
        )
      );
      return 0;
    }

    output.write(`Schema diff: ${leftPath} -> ${rightPath}`);

    if (
      result.added.length === 0 &&
      result.removed.length === 0 &&
      result.changed.length === 0
    ) {
      output.write("No differences found");
      return 0;
    }

    if (result.added.length > 0) {
      output.write("Added paths:");
      output.write(
        renderTable(
          [
            {
              key: "path",
              header: "Path"
            }
          ],
          result.added.map((path) => ({ path }))
        )
      );
    }

    if (result.removed.length > 0) {
      output.write("Removed paths:");
      output.write(
        renderTable(
          [
            {
              key: "path",
              header: "Path"
            }
          ],
          result.removed.map((path) => ({ path }))
        )
      );
    }

    if (result.changed.length > 0) {
      output.write("Changed values:");
      output.write(
        renderTable(
          [
            {
              key: "path",
              header: "Path"
            },
            {
              key: "left",
              header: "Left"
            },
            {
              key: "right",
              header: "Right"
            }
          ],
          result.changed.map((entry) => ({
            path: entry.path,
            left: JSON.stringify(entry.left),
            right: JSON.stringify(entry.right)
          }))
        )
      );
    }

    return 0;
  } catch (error) {
    output.error(`Schema diff failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
};
