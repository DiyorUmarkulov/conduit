import { ConduitBuilder, type ConduitBus, type DispatchResult, type OperationEnvelope } from "@conduit/core";

import { FakeDLQManager } from "./fake-dlq.js";
import { FakeProvider } from "./fake-provider.js";

export interface TestBusBundle {
  bus: ConduitBus;
  provider: FakeProvider;
  dlq: FakeDLQManager;
}

export const createConduitTestBus = (
  configure: (builder: ConduitBuilder) => ConduitBuilder
): TestBusBundle => {
  const builder = configure(new ConduitBuilder());
  const provider = new FakeProvider();
  const dlq = new FakeDLQManager();

  builder.registerProvider(provider);
  builder.withDlqManager(dlq);

  return {
    bus: builder.build(),
    provider,
    dlq
  };
};

export class RecordedDispatchBus {
  private readonly dispatched: OperationEnvelope[] = [];

  public constructor(private readonly bus: ConduitBus) {}

  public async dispatch(envelope: OperationEnvelope): Promise<DispatchResult> {
    this.dispatched.push(envelope);
    return this.bus.dispatch(envelope);
  }

  public snapshot(): OperationEnvelope[] {
    return [...this.dispatched];
  }
}
