export interface RabbitMQQueueDefinition {
  name: string;
  durable?: boolean;
  exclusive?: boolean;
  auto_delete?: boolean;
  arguments?: Record<string, unknown>;
}

export interface RabbitMQQueueBinding {
  queue: string;
  exchange: string;
  routing_key?: string;
  arguments?: Record<string, unknown>;
}

export interface RabbitMQQueueChannelLike {
  assertQueue(
    queue: string,
    options?: {
      durable?: boolean;
      exclusive?: boolean;
      autoDelete?: boolean;
      arguments?: Record<string, unknown>;
    }
  ): Promise<unknown> | unknown;
  bindQueue(
    queue: string,
    exchange: string,
    pattern: string,
    args?: Record<string, unknown>
  ): Promise<unknown> | unknown;
}

export class RabbitMQQueueTopology {
  public constructor(private readonly channel: RabbitMQQueueChannelLike) {}

  public async ensureQueue(definition: RabbitMQQueueDefinition): Promise<void> {
    await this.channel.assertQueue(definition.name, {
      durable: definition.durable ?? true,
      exclusive: definition.exclusive ?? false,
      autoDelete: definition.auto_delete ?? false,
      ...(definition.arguments !== undefined ? { arguments: definition.arguments } : {})
    });
  }

  public async ensureBindings(bindings: RabbitMQQueueBinding[]): Promise<void> {
    for (const binding of bindings) {
      await this.channel.bindQueue(
        binding.queue,
        binding.exchange,
        binding.routing_key ?? "",
        binding.arguments
      );
    }
  }

  public async ensure(
    definition: RabbitMQQueueDefinition,
    bindings: RabbitMQQueueBinding[] = []
  ): Promise<void> {
    await this.ensureQueue(definition);
    await this.ensureBindings(bindings);
  }
}
