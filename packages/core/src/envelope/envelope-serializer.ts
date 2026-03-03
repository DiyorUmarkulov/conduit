import type { OperationEnvelope } from "../types/envelope.js";

export interface EnvelopeSerializer {
  serialize(envelope: OperationEnvelope): Uint8Array;
  deserialize(buffer: Uint8Array): OperationEnvelope;
}

export class JsonEnvelopeSerializer implements EnvelopeSerializer {
  public serialize(envelope: OperationEnvelope): Uint8Array {
    return Buffer.from(JSON.stringify(envelope), "utf8");
  }

  public deserialize(buffer: Uint8Array): OperationEnvelope {
    const content = Buffer.from(buffer).toString("utf8");
    return JSON.parse(content) as OperationEnvelope;
  }
}
