export interface RabbitMQMessage {
  content: Buffer;
  fields: {
    deliveryTag: number;
    redelivered?: boolean;
    exchange?: string;
    routingKey?: string;
  };
  properties: {
    headers?: Record<string, unknown>;
    messageId?: string;
    timestamp?: number;
  };
}

export interface RabbitMQConsumerChannelLike {
  prefetch?(count: number, global?: boolean): Promise<unknown> | unknown;
  consume(
    queue: string,
    onMessage: (message: RabbitMQMessage | null) => void,
    options?: {
      noAck?: boolean;
      consumerTag?: string;
      exclusive?: boolean;
      arguments?: Record<string, unknown>;
    }
  ): Promise<{ consumerTag: string }> | { consumerTag: string };
  ack(message: RabbitMQMessage, allUpTo?: boolean): void;
  nack(message: RabbitMQMessage, allUpTo?: boolean, requeue?: boolean): void;
  reject?(message: RabbitMQMessage, requeue?: boolean): void;
  cancel?(consumerTag: string): Promise<void> | void;
}

export interface RabbitMQConsumerContext {
  message: RabbitMQMessage;
  headers: Record<string, unknown>;
  ack: () => void;
  nack: (requeue?: boolean) => void;
  reject: (requeue?: boolean) => void;
}

export interface RabbitMQConsumerOptions<TPayload = unknown> {
  queue: string;
  prefetch?: number;
  global_prefetch?: boolean;
  no_ack?: boolean;
  consumer_tag?: string;
  exclusive?: boolean;
  arguments?: Record<string, unknown>;
  auto_ack?: boolean;
  requeue_on_error?: boolean;
  deserialize?: (message: RabbitMQMessage) => TPayload;
  handler: (payload: TPayload, context: RabbitMQConsumerContext) => Promise<void> | void;
  on_error?: (
    error: unknown,
    context: RabbitMQConsumerContext
  ) => Promise<void> | void;
}

const defaultDeserializer = (message: RabbitMQMessage): unknown => {
  const content = message.content.toString("utf8");
  return JSON.parse(content);
};

export class RabbitMQConsumer<TPayload = unknown> {
  private consumerTag: string | undefined;
  private running = false;

  private readonly options: RabbitMQConsumerOptions<TPayload>;

  public constructor(
    private readonly channel: RabbitMQConsumerChannelLike,
    options: RabbitMQConsumerOptions<TPayload>
  ) {
    this.options = {
      ...options,
      auto_ack: options.auto_ack ?? !options.no_ack,
      requeue_on_error: options.requeue_on_error ?? false,
      deserialize: options.deserialize ?? (defaultDeserializer as any)
    };
  }

  public async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    if (this.options.prefetch && this.channel.prefetch && !this.options.no_ack) {
      await this.channel.prefetch(
        this.options.prefetch,
        this.options.global_prefetch ?? false
      );
    }

    const result = await this.channel.consume(
      this.options.queue,
      (message) => {
        if (!message) {
          return;
        }

        void this.handleMessage(message);
      },
      {
        ...(this.options.no_ack !== undefined ? { noAck: this.options.no_ack } : {}),
        ...(this.options.consumer_tag !== undefined
          ? { consumerTag: this.options.consumer_tag }
          : {}),
        ...(this.options.exclusive !== undefined ? { exclusive: this.options.exclusive } : {}),
        ...(this.options.arguments !== undefined ? { arguments: this.options.arguments } : {})
      }
    );

    this.consumerTag = result.consumerTag;
  }

  public async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    if (this.consumerTag && this.channel.cancel) {
      await this.channel.cancel(this.consumerTag);
    }

    this.consumerTag = undefined;
    this.running = false;
  }

  public isRunning(): boolean {
    return this.running;
  }

  private async handleMessage(message: RabbitMQMessage): Promise<void> {
    const headers = message.properties.headers ?? {};
    let settled = false;

    const context: RabbitMQConsumerContext = {
      message,
      headers,
      ack: () => {
        if (settled || this.options.no_ack) {
          return;
        }

        settled = true;
        this.channel.ack(message);
      },
      nack: (requeue) => {
        if (settled || this.options.no_ack) {
          return;
        }

        settled = true;
        this.channel.nack(message, false, requeue);
      },
      reject: (requeue) => {
        if (settled || this.options.no_ack) {
          return;
        }

        settled = true;
        if (this.channel.reject) {
          this.channel.reject(message, requeue);
        } else {
          this.channel.nack(message, false, requeue);
        }
      }
    };

    try {
      const payload = (this.options.deserialize ?? defaultDeserializer)(message) as TPayload;
      await this.options.handler(payload, context);

      if (this.options.auto_ack && !settled && !this.options.no_ack) {
        context.ack();
      }
    } catch (error) {
      if (this.options.on_error) {
        await this.options.on_error(error, context);
      }

      if (this.options.auto_ack && !settled && !this.options.no_ack) {
        context.nack(this.options.requeue_on_error ?? false);
      }
    }
  }
}
