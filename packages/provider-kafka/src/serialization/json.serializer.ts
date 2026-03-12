import type { OperationEnvelope, ProviderDispatchRequest, RouteConfig } from "@conduit/core";

export interface ConduitKafkaMessage<TPayload = unknown> {
  envelope: OperationEnvelope<TPayload>;
  route: RouteConfig;
  handler_id: string;
  emitted_at: string;
}

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

const toStringPayload = (payload: string | Uint8Array): string => {
  if (typeof payload === "string") {
    return payload;
  }

  return textDecoder.decode(payload);
};

export const serializeConduitMessage = (
  request: ProviderDispatchRequest
): Uint8Array => {
  const payload: ConduitKafkaMessage = {
    envelope: request.envelope,
    route: request.route,
    handler_id: request.handler.id,
    emitted_at: new Date().toISOString()
  };

  return textEncoder.encode(JSON.stringify(payload));
};

export const deserializeConduitMessage = (
  payload: string | Uint8Array
): ConduitKafkaMessage => {
  const decoded = JSON.parse(toStringPayload(payload)) as ConduitKafkaMessage;

  return decoded;
};
