import type { IDLQManager } from "./dlq/dlq-manager.js";
import type { ICorrelationStore } from "./correlation/correlation-store.js";
import {
  createIdempotencyHintMiddleware,
  createLoggingMiddleware,
  createMetricsMiddleware,
  createTracingMiddleware,
  createValidationMiddleware
} from "./middleware/index.js";
import type { ILogger } from "./observability/logging/logger.js";
import type { IMetricsRegistry } from "./observability/metrics/registry.js";
import type { ITracer } from "./observability/tracing/tracer.js";
import type { DispatchMiddleware } from "./middleware/middleware-pipeline.js";
import { ConduitRouter } from "./router/conduit-router.js";
import { HandlerRegistry } from "./router/handler-registry.js";
import { RouteBuilder } from "./router/route-builder.js";
import { RouteRegistry } from "./router/route-registry.js";
import { RetryExecutor } from "./retry/retry-executor.js";
import { ConduitBus } from "./conduit.js";
import type { ITransportProvider } from "./types/provider.js";
import type { RouteConfig } from "./types/route.js";

export interface ProductionDefaultsOptions {
  logger?: ILogger;
  tracer?: ITracer;
  metrics_registry?: IMetricsRegistry;
  include_validation_middleware?: boolean;
  include_idempotency_hint_middleware?: boolean;
}

export class ConduitBuilder {
  private readonly routeRegistry = new RouteRegistry();
  private readonly handlerRegistry = new HandlerRegistry();
  private readonly providers = new Map<string, ITransportProvider>();
  private readonly middlewares: DispatchMiddleware[] = [];
  private dlqManager?: IDLQManager;
  private correlationStore?: ICorrelationStore;
  private retryExecutor?: RetryExecutor;

  public route(operationName: string): RouteBuilder {
    return new RouteBuilder(operationName);
  }

  public addRoute(route: RouteConfig | RouteBuilder): this {
    const builtRoute = route instanceof RouteBuilder ? route.build() : route;
    this.routeRegistry.register(builtRoute);
    return this;
  }

  public defineRoute(
    operationName: string,
    configure: (builder: RouteBuilder) => RouteBuilder
  ): this {
    const builtRoute = configure(new RouteBuilder(operationName)).build();
    this.routeRegistry.register(builtRoute);
    return this;
  }

  public registerProvider(provider: ITransportProvider): this {
    this.providers.set(provider.name, provider);
    return this;
  }

  public withDlqManager(dlqManager: IDLQManager): this {
    this.dlqManager = dlqManager;
    return this;
  }

  public withRetryExecutor(retryExecutor: RetryExecutor): this {
    this.retryExecutor = retryExecutor;
    return this;
  }

  public withCorrelationStore(correlationStore: ICorrelationStore): this {
    this.correlationStore = correlationStore;
    return this;
  }

  public withProductionDefaults(options: ProductionDefaultsOptions = {}): this {
    if (options.include_validation_middleware ?? true) {
      this.use(createValidationMiddleware());
    }

    if (options.include_idempotency_hint_middleware ?? true) {
      this.use(createIdempotencyHintMiddleware());
    }

    this.use(
      createTracingMiddleware({
        ...(options.tracer ? { tracer: options.tracer } : {})
      })
    );

    this.use(
      createMetricsMiddleware({
        ...(options.metrics_registry
          ? { registry: options.metrics_registry }
          : {})
      })
    );

    this.use(
      createLoggingMiddleware({
        ...(options.logger ? { logger: options.logger } : {})
      })
    );

    return this;
  }

  public use(middleware: DispatchMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  public build(): ConduitBus {
    const router = new ConduitRouter({
      route_registry: this.routeRegistry,
      handler_registry: this.handlerRegistry,
      providers: this.providers,
      dlq_manager: this.dlqManager,
      middlewares: this.middlewares,
      retry_executor: this.retryExecutor
    });

    return new ConduitBus(router, this.handlerRegistry, this.correlationStore);
  }

  public listRoutes(): RouteConfig[] {
    return this.routeRegistry.list();
  }
}

export const createConduitBuilder = (): ConduitBuilder => new ConduitBuilder();
