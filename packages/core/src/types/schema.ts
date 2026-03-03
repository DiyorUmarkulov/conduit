const SEMVER_RE =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)$/;

export interface SchemaVersion {
  major: number;
  minor: number;
  patch: number;
}

interface Comparator {
  operator: ">" | ">=" | "<" | "<=" | "=";
  version: SchemaVersion;
}

export const parseSchemaVersion = (value: string): SchemaVersion | null => {
  const match = value.match(SEMVER_RE);

  if (!match?.groups) {
    return null;
  }

  return {
    major: Number(match.groups.major),
    minor: Number(match.groups.minor),
    patch: Number(match.groups.patch)
  };
};

export const compareSchemaVersion = (
  left: SchemaVersion,
  right: SchemaVersion
): number => {
  if (left.major !== right.major) {
    return left.major - right.major;
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }

  return left.patch - right.patch;
};

const parseComparator = (token: string): Comparator | null => {
  const comparator = token.match(/^(>=|<=|>|<|=)?(.+)$/);

  if (!comparator) {
    return null;
  }

  const [, operatorRaw, versionRaw] = comparator;

  if (!versionRaw) {
    return null;
  }

  const operator = (operatorRaw ?? "=") as Comparator["operator"];
  const parsed = parseSchemaVersion(versionRaw.trim());

  if (!parsed) {
    return null;
  }

  return {
    operator,
    version: parsed
  };
};

const checkComparator = (version: SchemaVersion, comparator: Comparator): boolean => {
  const compared = compareSchemaVersion(version, comparator.version);

  switch (comparator.operator) {
    case ">":
      return compared > 0;
    case ">=":
      return compared >= 0;
    case "<":
      return compared < 0;
    case "<=":
      return compared <= 0;
    case "=":
      return compared === 0;
    default:
      return false;
  }
};

const checkWildcard = (version: SchemaVersion, range: string): boolean => {
  const normalized = range.trim();

  if (normalized === "*" || normalized.toLowerCase() === "x") {
    return true;
  }

  const parts = normalized.split(".");

  if (parts.length > 3) {
    return false;
  }

  const [major, minor, patch] = parts;

  if (major && major !== "x" && major !== "*") {
    if (version.major !== Number(major)) {
      return false;
    }
  }

  if (minor && minor !== "x" && minor !== "*") {
    if (version.minor !== Number(minor)) {
      return false;
    }
  }

  if (patch && patch !== "x" && patch !== "*") {
    if (version.patch !== Number(patch)) {
      return false;
    }
  }

  return true;
};

export const satisfiesSchemaRange = (version: string, range: string): boolean => {
  const parsedVersion = parseSchemaVersion(version);

  if (!parsedVersion) {
    return false;
  }

  const normalizedRange = range.trim();

  if (!normalizedRange) {
    return false;
  }

  if (!/[<>]=?|=/.test(normalizedRange)) {
    return checkWildcard(parsedVersion, normalizedRange);
  }

  const tokens = normalizedRange.split(/\s+/).filter(Boolean);

  return tokens.every((token) => {
    const comparator = parseComparator(token);
    return comparator ? checkComparator(parsedVersion, comparator) : false;
  });
};
