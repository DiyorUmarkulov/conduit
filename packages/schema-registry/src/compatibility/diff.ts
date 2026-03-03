export interface SchemaDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const walk = (
  left: unknown,
  right: unknown,
  path: string,
  diff: SchemaDiff
): void => {
  if (left === right) {
    return;
  }

  if (isObject(left) && isObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);

    for (const key of [...keys].sort()) {
      const nextPath = path ? `${path}.${key}` : key;

      if (!(key in left)) {
        diff.added.push(nextPath);
        continue;
      }

      if (!(key in right)) {
        diff.removed.push(nextPath);
        continue;
      }

      walk(left[key], right[key], nextPath, diff);
    }

    return;
  }

  diff.changed.push(path);
};

export const diffSchemas = (left: unknown, right: unknown): SchemaDiff => {
  const diff: SchemaDiff = {
    added: [],
    removed: [],
    changed: []
  };

  walk(left, right, "", diff);
  return diff;
};
