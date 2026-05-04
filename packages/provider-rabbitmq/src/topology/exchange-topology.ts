export interface RabbitMQExchangeDefinition {
  name: string;
  type?: "direct" | "topic" | "fanout" | "headers" | (string & {});
  durable?: boolean;
  auto_delete?: boolean;
  internal?: boolean;
  arguments?: Record<string, unknown>;
}

export interface RabbitMQExchangeBinding {
  destination: string;
  source: string;
  routing_key?: string;
  arguments?: Record<string, unknown>;
}

export interface RabbitMQExchangeChannelLike {
  assertExchange(
    exchange: string,
    type: string,
    options?: {
      durable?: boolean;
      autoDelete?: boolean;
      internal?: boolean;
      arguments?: Record<string, unknown>;
    }
  ): Promise<unknown> | unknown;
  bindExchange(
    destination: string,
    source: string,
    pattern: string,
    args?: Record<string, unknown>
  ): Promise<unknown> | unknown;
}

export class RabbitMQExchangeTopology {
  public constructor(private readonly channel: RabbitMQExchangeChannelLike) {}

  public async ensureExchange(definition: RabbitMQExchangeDefinition): Promise<void> {
    await this.channel.assertExchange(definition.name, definition.type ?? "topic", {
      durable: definition.durable ?? true,
      autoDelete: definition.auto_delete ?? false,
      internal: definition.internal ?? false,
      ...(definition.arguments !== undefined ? { arguments: definition.arguments } : {})
    });
  }

  public async ensureBindings(bindings: RabbitMQExchangeBinding[]): Promise<void> {
    for (const binding of bindings) {
      await this.channel.bindExchange(
        binding.destination,
        binding.source,
        binding.routing_key ?? "",
        binding.arguments
      );
    }
  }

  public async ensure(
    definition: RabbitMQExchangeDefinition,
    bindings: RabbitMQExchangeBinding[] = []
  ): Promise<void> {
    await this.ensureExchange(definition);
    await this.ensureBindings(bindings);
  }
}
