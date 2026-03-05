import type { OperationEnvelope } from "./envelope.js";
import type { RegisteredHandler } from "./handler.js";
import type { RouteConfig } from "./route.js";
import type { ProviderDispatchStatus } from "./status.js";

export type { ProviderDispatchStatus } from "./status.js";

export interface ProviderDispatchRequest {
  envelope: OperationEnvelope;
  route: RouteConfig;
  handler: RegisteredHandler;
  timeout_ms?: number;
}

export interface ProviderDispatchResult {
  status: ProviderDispatchStatus;
}

export interface ITransportProvider {
  readonly name: string;
  dispatch(request: ProviderDispatchRequest): Promise<ProviderDispatchResult>;
  getBacklogSize?(route: RouteConfig): Promise<number> | number;
}
