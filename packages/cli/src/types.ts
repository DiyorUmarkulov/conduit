import type {
  DispatchResult,
  IDLQManager,
  OperationEnvelope,
  RouteConfig
} from "@conduit/core";

export interface CliOutput {
  write(message: string): void;
  error(message: string): void;
}

export interface ConduitCliConfig {
  routes?: RouteConfig[] | (() => RouteConfig[] | Promise<RouteConfig[]>);
  dlq_manager?: IDLQManager | (() => IDLQManager | Promise<IDLQManager>);
  dispatch?: (envelope: OperationEnvelope) => Promise<DispatchResult | unknown>;
}

export interface ParsedArgs {
  command: string | undefined;
  subcommand: string | undefined;
  positionals: string[];
  flags: Map<string, string | boolean>;
}
