const escapeForRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const matchOperationPattern = (
  pattern: string,
  operationName: string
): boolean => {
  const patternParts = pattern.split(".");
  const operationParts = operationName.split(".");

  if (patternParts.length !== operationParts.length) {
    return false;
  }

  return patternParts.every((part, index) => {
    if (part === "*") {
      return true;
    }

    return escapeForRegex(part) === escapeForRegex(operationParts[index] ?? "");
  });
};

export const patternSpecificity = (pattern: string): number =>
  pattern
    .split(".")
    .filter((part) => part !== "*")
    .join(".")
    .length;
