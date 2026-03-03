import type { OperationEnvelope } from "../types/envelope.js";

export interface Principal {
  id: string;
  service?: string;
  roles?: string[];
  claims?: Record<string, unknown>;
}

export interface AuthContext {
  authenticated: boolean;
  principal: Principal;
  mechanism: string;
}

export interface IAuthMechanism {
  readonly name: string;
  authenticate(envelope: OperationEnvelope): Promise<AuthContext> | AuthContext;
}
