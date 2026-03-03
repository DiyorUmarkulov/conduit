import type { AuthContext, IAuthMechanism } from "../auth-context.js";
import type { OperationEnvelope } from "../../types/envelope.js";

export class NoopAuthMechanism implements IAuthMechanism {
  public readonly name = "NOOP";

  public authenticate(envelope: OperationEnvelope): AuthContext {
    return {
      authenticated: true,
      mechanism: this.name,
      principal: {
        id: envelope.metadata.source_service,
        service: envelope.metadata.source_service
      }
    };
  }
}
