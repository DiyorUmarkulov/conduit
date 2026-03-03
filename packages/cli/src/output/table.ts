const pad = (value: string, size: number): string =>
  value + " ".repeat(Math.max(0, size - value.length));

const truncate = (value: string, size: number): string => {
  if (size <= 1 || value.length <= size) {
    return value;
  }

  return `${value.slice(0, Math.max(0, size - 1))}...`;
};

export interface TableColumn {
  key: string;
  header: string;
  width?: number;
}

export type TableRow = Record<string, string | number | boolean | null | undefined>;

export const renderTable = (columns: TableColumn[], rows: TableRow[]): string => {
  const widths = columns.map((column) => {
    const contentWidth = rows.reduce((max, row) => {
      const value = row[column.key] ?? "";
      return Math.max(max, String(value).length);
    }, column.header.length);

    return column.width ? Math.min(column.width, Math.max(column.header.length, contentWidth)) : contentWidth;
  });

  const header = columns
    .map((column, index) => pad(truncate(column.header, widths[index] ?? column.header.length), widths[index] ?? column.header.length))
    .join(" | ");

  const separator = widths.map((width) => "-".repeat(width)).join("-+-");

  const body = rows.map((row) =>
    columns
      .map((column, index) => {
        const value = row[column.key] ?? "";
        const width = widths[index] ?? column.header.length;
        return pad(truncate(String(value), width), width);
      })
      .join(" | ")
  );

  return [header, separator, ...body].join("\n");
};
