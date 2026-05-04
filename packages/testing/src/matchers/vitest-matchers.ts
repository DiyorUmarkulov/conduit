import { expect } from "vitest";
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

export const vitestConduitMatchers = {
  toHaveDispatched: buildMatcher(),
  toHaveDispatchedCommand: buildMatcher("COMMAND"),
  toHaveDispatchedEvent: buildMatcher("EVENT")
};

export const registerVitestMatchers = (): void => {
  expect.extend(vitestConduitMatchers);
};

declare module "vitest" {
  interface Assertion<T = any> {
    toHaveDispatched(
      operationName?: string,
      options?: { times?: number; predicate?: (envelope: any) => boolean }
    ): T;
    toHaveDispatchedCommand(
      operationName?: string,
      options?: { times?: number; predicate?: (envelope: any) => boolean }
    ): T;
    toHaveDispatchedEvent(
      operationName?: string,
      options?: { times?: number; predicate?: (envelope: any) => boolean }
    ): T;
  }
  interface AsymmetricMatchersContaining {
    toHaveDispatched(
      operationName?: string,
      options?: { times?: number; predicate?: (envelope: any) => boolean }
    ): void;
    toHaveDispatchedCommand(
      operationName?: string,
      options?: { times?: number; predicate?: (envelope: any) => boolean }
    ): void;
    toHaveDispatchedEvent(
      operationName?: string,
      options?: { times?: number; predicate?: (envelope: any) => boolean }
    ): void;
  }
}
