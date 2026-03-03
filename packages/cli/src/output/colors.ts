const isColorEnabled = (): boolean =>
  Boolean(process.stdout.isTTY) && process.env.NO_COLOR !== "1";

const apply = (code: string, value: string): string => {
  if (!isColorEnabled()) {
    return value;
  }

  return `\u001b[${code}m${value}\u001b[0m`;
};

export const colors = {
  green: (value: string): string => apply("32", value),
  yellow: (value: string): string => apply("33", value),
  red: (value: string): string => apply("31", value),
  cyan: (value: string): string => apply("36", value),
  bold: (value: string): string => apply("1", value)
};
