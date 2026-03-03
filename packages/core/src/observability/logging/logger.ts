import type { StructuredLogEntry } from "./structured-entry.js";

export interface ILogger {
  log(entry: StructuredLogEntry): void;
}

export interface ConsoleJsonLoggerOptions {
  sink?: (line: string, level: StructuredLogEntry["level"]) => void;
}

export class NoopLogger implements ILogger {
  public log(_entry: StructuredLogEntry): void {}
}

export class ConsoleJsonLogger implements ILogger {
  private readonly sink: (line: string, level: StructuredLogEntry["level"]) => void;

  public constructor(options: ConsoleJsonLoggerOptions = {}) {
    this.sink =
      options.sink ??
      ((line, level) => {
        if (level === "ERROR" || level === "WARN") {
          process.stderr.write(`${line}\n`);
          return;
        }

        process.stdout.write(`${line}\n`);
      });
  }

  public log(entry: StructuredLogEntry): void {
    this.sink(JSON.stringify(entry), entry.level);
  }
}
