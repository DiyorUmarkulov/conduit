import { ConfigurationError } from "../types/errors.js";
import type { InjectionToken } from "./token.js";

export interface ResolutionContext {
  container: ConduitContainer;
}

export interface ValueProvider<T> {
  kind: "value";
  value: T;
}

export interface FactoryProvider<T> {
  kind: "factory";
  singleton?: boolean;
  create: (context: ResolutionContext) => T;
}

export interface ClassProvider<T> {
  kind: "class";
  singleton?: boolean;
  use_class: new () => T;
}

export type ProviderDescriptor<T> =
  | ValueProvider<T>
  | FactoryProvider<T>
  | ClassProvider<T>;

interface ResolvedProvider<T> {
  descriptor: ProviderDescriptor<T>;
  instance?: T;
  creating: boolean;
}

const asValueProvider = <T>(value: T): ValueProvider<T> => ({
  kind: "value",
  value
});

const resolveFromDescriptor = <T>(
  descriptor: ProviderDescriptor<T>,
  context: ResolutionContext
): T => {
  switch (descriptor.kind) {
    case "value":
      return descriptor.value;
    case "factory":
      return descriptor.create(context);
    case "class":
      return new descriptor.use_class();
    default:
      throw new ConfigurationError("Unsupported provider descriptor");
  }
};

const isSingleton = <T>(descriptor: ProviderDescriptor<T>): boolean => {
  if (descriptor.kind === "value") {
    return true;
  }

  return descriptor.singleton ?? true;
};

export class ConduitContainer {
  private readonly providers = new Map<symbol, ResolvedProvider<unknown>>();

  public constructor(private readonly parent?: ConduitContainer) {}

  public register<T>(token: InjectionToken<T>, descriptor: ProviderDescriptor<T>): this {
    this.providers.set(token, {
      descriptor,
      creating: false
    });
    return this;
  }

  public registerValue<T>(token: InjectionToken<T>, value: T): this {
    return this.register(token, asValueProvider(value));
  }

  public registerFactory<T>(
    token: InjectionToken<T>,
    create: (context: ResolutionContext) => T,
    singleton = true
  ): this {
    return this.register(token, {
      kind: "factory",
      singleton,
      create
    });
  }

  public registerClass<T>(
    token: InjectionToken<T>,
    useClass: new () => T,
    singleton = true
  ): this {
    return this.register(token, {
      kind: "class",
      singleton,
      use_class: useClass
    });
  }

  public has(token: InjectionToken<unknown>): boolean {
    return this.providers.has(token) || Boolean(this.parent?.has(token));
  }

  public resolve<T>(token: InjectionToken<T>): T {
    const own = this.providers.get(token) as ResolvedProvider<T> | undefined;

    if (!own) {
      if (this.parent) {
        return this.parent.resolve(token);
      }

      throw new ConfigurationError(`No provider registered for token ${String(token)}`);
    }

    if (own.creating) {
      throw new ConfigurationError(`Circular dependency for token ${String(token)}`);
    }

    if (isSingleton(own.descriptor) && own.instance !== undefined) {
      return own.instance;
    }

    own.creating = true;

    try {
      const instance = resolveFromDescriptor(own.descriptor, {
        container: this
      });

      if (isSingleton(own.descriptor)) {
        own.instance = instance;
      }

      return instance;
    } finally {
      own.creating = false;
    }
  }

  public createChild(): ConduitContainer {
    return new ConduitContainer(this);
  }
}
