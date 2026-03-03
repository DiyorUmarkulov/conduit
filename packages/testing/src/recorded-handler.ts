import type { HandlerExecutionContext, OperationEnvelope } from "@conduit/core";

export interface RecordedCall {
  envelope: OperationEnvelope;
  context: HandlerExecutionContext;
}

export const createRecordedHandler = <TResult = unknown>(
  implementation?: (envelope: OperationEnvelope, context: HandlerExecutionContext) => TResult | Promise<TResult>
): {
  calls: RecordedCall[];
  handle: (envelope: OperationEnvelope, context: HandlerExecutionContext) => Promise<TResult | undefined>;
} => {
  const calls: RecordedCall[] = [];

  const handle = async (
    envelope: OperationEnvelope,
    context: HandlerExecutionContext
  ): Promise<TResult | undefined> => {
    calls.push({
      envelope,
      context
    });

    if (!implementation) {
      return undefined;
    }

    return implementation(envelope, context);
  };

  return {
    calls,
    handle
  };
};
