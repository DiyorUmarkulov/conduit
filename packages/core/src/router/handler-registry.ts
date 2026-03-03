import type { OperationEnvelope } from "../types/envelope.js";
import { ConfigurationError, NoHandlerError } from "../types/errors.js";
import type { OperationHandler, RegisteredHandler } from "../types/handler.js";
import type { OperationType } from "../types/operation.js";
import { matchOperationPattern } from "./route-matcher.js";
import { resolveHandlersByVersion } from "./version-resolver.js";

export interface HandlerRegistrationOptions {
  consumer_group?: string;
}

export class HandlerRegistry {
  private readonly handlers: RegisteredHandler[] = [];
  private sequence = 0;
  private readonly eventGroupCursor = new Map<string, number>();

  public register(
    operationType: OperationType,
    operationName: string,
    versionRange: string,
    handler: OperationHandler,
    options: HandlerRegistrationOptions = {}
  ): string {
    this.sequence += 1;

    const id = `handler-${String(this.sequence).padStart(4, "0")}`;

    this.handlers.push({
      id,
      operation_name: operationName,
      operation_type: operationType,
      version_range: versionRange,
      ...(options.consumer_group !== undefined
        ? { consumer_group: options.consumer_group }
        : {}),
      handle: handler
    });

    return id;
  }

  public registerCommand(
    operationName: string,
    versionRange: string,
    handler: OperationHandler
  ): string {
    return this.register("COMMAND", operationName, versionRange, handler);
  }

  public registerEvent(
    operationName: string,
    versionRange: string,
    handler: OperationHandler,
    options: HandlerRegistrationOptions = {}
  ): string {
    return this.register("EVENT", operationName, versionRange, handler, options);
  }

  public resolve(envelope: OperationEnvelope): RegisteredHandler[] {
    const operationMatched = this.handlers.filter(
      (handler) =>
        handler.operation_type === envelope.operation_type &&
        matchOperationPattern(handler.operation_name, envelope.operation_name)
    );

    const versionMatched = resolveHandlersByVersion(
      operationMatched,
      envelope.schema_version
    );

    if (envelope.operation_type === "COMMAND") {
      if (versionMatched.length === 0) {
        throw new NoHandlerError(
          `No COMMAND handler for ${envelope.operation_name}@${envelope.schema_version}`
        );
      }

      if (versionMatched.length > 1) {
        throw new ConfigurationError(
          `COMMAND ${envelope.operation_name} resolved to ${versionMatched.length} handlers`
        );
      }

      return versionMatched;
    }

    return this.resolveEventHandlers(versionMatched);
  }

  private resolveEventHandlers(handlers: RegisteredHandler[]): RegisteredHandler[] {
    if (handlers.length <= 1) {
      return handlers;
    }

    const selected: RegisteredHandler[] = [];
    const grouped = new Map<string, RegisteredHandler[]>();

    for (const handler of handlers) {
      if (!handler.consumer_group) {
        selected.push(handler);
        continue;
      }

      const group = grouped.get(handler.consumer_group) ?? [];
      group.push(handler);
      grouped.set(handler.consumer_group, group);
    }

    for (const [groupName, groupHandlers] of grouped) {
      const cursor = this.eventGroupCursor.get(groupName) ?? 0;
      const selectedIndex = cursor % groupHandlers.length;
      const selectedHandler = groupHandlers[selectedIndex];

      if (selectedHandler) {
        selected.push(selectedHandler);
      }

      this.eventGroupCursor.set(groupName, cursor + 1);
    }

    return selected;
  }
}
