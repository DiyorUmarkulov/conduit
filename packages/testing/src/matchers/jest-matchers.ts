import type { OperationType } from "@conduit/core";

import { formatDispatchMessage, matchDispatch } from "./matcher-utils.js";

interface MatcherContext {
  isNot: boolean;
}

const buildMatcher = (operationType?: OperationType) =>
  function (
    this: MatcherContext,
    received: unknown,
    operationName?: string,
    options: { times?: number; predicate?: (envelope: any) => boolean } = {}
  ) {
    const result = matchDispatch(received, operationName, {
      ...options,
      ...(operationType ? { operation_type: operationType } : {})
    });

    return {
      pass: result.pass,
      message: () =>
        formatDispatchMessage(
          result.pass,
          operationName,
          result.count,
          options.times
        )
    };
  };

export const jestConduitMatchers = {
  toHaveDispatched: buildMatcher(),
  toHaveDispatchedCommand: buildMatcher("COMMAND"),
  toHaveDispatchedEvent: buildMatcher("EVENT")
};

export const registerJestMatchers = (): void => {
  if (typeof expect === "undefined") {
    throw new Error("Jest expect is not available");
  }

  expect.extend(jestConduitMatchers);
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toHaveDispatched(
        operationName?: string,
        options?: { times?: number; predicate?: (envelope: any) => boolean }
      ): R;
      toHaveDispatchedCommand(
        operationName?: string,
        options?: { times?: number; predicate?: (envelope: any) => boolean }
      ): R;
      toHaveDispatchedEvent(
        operationName?: string,
        options?: { times?: number; predicate?: (envelope: any) => boolean }
      ): R;
    }
  }
}
