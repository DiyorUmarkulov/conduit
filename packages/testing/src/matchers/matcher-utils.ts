import type { OperationEnvelope, OperationType } from "@conduit/core";

import type { RecordedDispatchBus } from "../conduit-test-bus.js";
import type {
  FakeProvider,
  FakeProviderDispatchRecord
} from "../fake-provider.js";

export interface DispatchMatchOptions {
  operation_type?: OperationType;
  times?: number;
  predicate?: (envelope: OperationEnvelope) => boolean;
}

const isEnvelope = (value: unknown): value is OperationEnvelope =>
  typeof value === "object" &&
  value !== null &&
  "operation_id" in value &&
  "operation_name" in value;

const fromProviderRecords = (
  records: FakeProviderDispatchRecord[]
): OperationEnvelope[] => records.map((record) => record.request.envelope);

export const extractEnvelopes = (received: unknown): OperationEnvelope[] => {
  if (!received) {
    return [];
  }

  if (Array.isArray(received)) {
    if (received.length === 0) {
      return [];
    }

    if (isEnvelope(received[0])) {
      return received as OperationEnvelope[];
    }

    const maybeRecords = received as FakeProviderDispatchRecord[];
    if (maybeRecords[0]?.request?.envelope) {
      return fromProviderRecords(maybeRecords);
    }
  }

  const asRecordBus = received as RecordedDispatchBus;
  if (typeof (asRecordBus as RecordedDispatchBus).snapshot === "function") {
    return (asRecordBus as RecordedDispatchBus).snapshot();
  }

  const asProvider = received as FakeProvider;
  if (typeof asProvider.recordsSnapshot === "function") {
    return fromProviderRecords(asProvider.recordsSnapshot());
  }

  return [];
};

export const matchDispatch = (
  received: unknown,
  operationName?: string,
  options: DispatchMatchOptions = {}
): { pass: boolean; count: number; envelopes: OperationEnvelope[] } => {
  const envelopes = extractEnvelopes(received);
  const filtered = envelopes.filter((envelope) => {
    if (operationName && envelope.operation_name !== operationName) {
      return false;
    }

    if (options.operation_type && envelope.operation_type !== options.operation_type) {
      return false;
    }

    if (options.predicate && !options.predicate(envelope)) {
      return false;
    }

    return true;
  });

  const count = filtered.length;
  const times = options.times;

  return {
    pass: times !== undefined ? count === times : count > 0,
    count,
    envelopes: filtered
  };
};

export const formatDispatchMessage = (
  pass: boolean,
  operationName: string | undefined,
  count: number,
  times: number | undefined
): string => {
  const name = operationName ?? "<any operation>";

  if (times !== undefined) {
    return pass
      ? `expected ${name} not to be dispatched ${times} times`
      : `expected ${name} to be dispatched ${times} times, but got ${count}`;
  }

  return pass
    ? `expected ${name} not to be dispatched`
    : `expected ${name} to be dispatched`;
};
