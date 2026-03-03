import type { OperationEnvelope } from "../types/envelope.js";
import { ConfigurationError, NoHandlerError } from "../types/errors.js";
import type { RouteConfig } from "../types/route.js";
import { matchOperationPattern, patternSpecificity } from "./route-matcher.js";

export class RouteRegistry {
  private readonly routes: RouteConfig[] = [];

  public register(route: RouteConfig): void {
    const duplicate = this.routes.find(
      (entry) =>
        entry.operation_name === route.operation_name &&
        entry.operation_type === route.operation_type
    );

    if (duplicate) {
      throw new ConfigurationError(
        `Route already exists for ${route.operation_type}:${route.operation_name}`
      );
    }

    this.routes.push(route);
  }

  public list(): RouteConfig[] {
    return [...this.routes];
  }

  public resolve(envelope: OperationEnvelope): RouteConfig {
    const matched = this.routes.filter(
      (route) =>
        route.operation_type === envelope.operation_type &&
        matchOperationPattern(route.operation_name, envelope.operation_name)
    );

    if (matched.length === 0) {
      throw new NoHandlerError(
        `No route for ${envelope.operation_type}:${envelope.operation_name}`
      );
    }

    if (matched.length === 1) {
      const only = matched[0];

      if (!only) {
        throw new NoHandlerError(
          `No route for ${envelope.operation_type}:${envelope.operation_name}`
        );
      }

      return only;
    }

    const sorted = [...matched].sort(
      (left, right) =>
        patternSpecificity(right.operation_name) -
        patternSpecificity(left.operation_name)
    );

    const first = sorted[0];
    const second = sorted[1];

    if (!first) {
      throw new NoHandlerError(
        `No route for ${envelope.operation_type}:${envelope.operation_name}`
      );
    }

    if (
      second &&
      patternSpecificity(first.operation_name) ===
        patternSpecificity(second.operation_name)
    ) {
      throw new ConfigurationError(
        `Ambiguous routes for ${envelope.operation_name}`
      );
    }

    return first;
  }
}
