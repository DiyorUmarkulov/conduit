export interface NatsMessageLike {
  subject: string;
  data: Uint8Array;
  headers?: Record<string, string>;
  reply?: string;
  respond?(data: Uint8Array): void;
  ack?(): void;
  nak?(delay?: number): void;
  term?(): void;
  inProgress?(): void;
}

export interface NatsSubscriptionLike extends AsyncIterable<NatsMessageLike> {
  unsubscribe(): void;
  drain?(): Promise<void>;
}

export interface NatsConnectionLike {
  subscribe(subject: string, options?: { queue?: string }): NatsSubscriptionLike;
}

export interface NatsJetStreamClientLike {
  subscribe(subject: string, options?: Record<string, unknown>): NatsSubscriptionLike;
}

export interface NatsConsumerContext {
  message: NatsMessageLike;
  headers: Record<string, string>;
  ack: () => void;
  nack: (delay?: number) => void;
  term: () => void;
  in_progress: () => void;
}

export interface NatsCoreConsumerOptions<TPayload = unknown> {
  subject: string;
  queue?: string;
  deserialize?: (message: NatsMessageLike) => TPayload;
  handler: (payload: TPayload, context: NatsConsumerContext) => Promise<void> | void;
  on_error?: (error: unknown, context: NatsConsumerContext) => Promise<void> | void;
  abort_signal?: AbortSignal;
  max_messages?: number;
}

export interface NatsJetStreamConsumerOptions<TPayload = unknown>
  extends NatsCoreConsumerOptions<TPayload> {
  subscribe_options?: Record<string, unknown>;
  auto_ack?: boolean;
  requeue_on_error?: boolean;
}

const defaultDeserializer = (message: NatsMessageLike): unknown => {
  const decoded = new TextDecoder().decode(message.data);
  return JSON.parse(decoded);
};

const createContext = (message: NatsMessageLike): NatsConsumerContext => ({
  message,
  headers: message.headers ?? {},
  ack: () => message.ack?.(),
  nack: (delay?: number) => message.nak?.(delay),
  term: () => message.term?.(),
  in_progress: () => message.inProgress?.()
});

export class NatsCoreConsumer<TPayload = unknown> {
  private subscription?: NatsSubscriptionLike;
  private running = false;
  private runPromise?: Promise<void>;

  public constructor(
    private readonly connection: NatsConnectionLike,
    private readonly options: NatsCoreConsumerOptions<TPayload>
  ) {}

  public async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    this.subscription = this.connection.subscribe(this.options.subject, {
      ...(this.options.queue ? { queue: this.options.queue } : {})
    });

    this.runPromise = this.processLoop(this.subscription);
    this.runPromise.catch(() => undefined);
  }

  public async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    if (this.subscription) {
      if (this.subscription.drain) {
        await this.subscription.drain();
      } else {
        this.subscription.unsubscribe();
      }
    }

    if (this.runPromise) {
      await this.runPromise;
    }

    this.running = false;
  }

  public isRunning(): boolean {
    return this.running;
  }

  private async processLoop(subscription: NatsSubscriptionLike): Promise<void> {
    const deserialize = this.options.deserialize ?? (defaultDeserializer as any);
    const abortSignal = this.options.abort_signal;
    let processed = 0;

    for await (const message of subscription) {
      if (abortSignal?.aborted) {
        break;
      }

      const context = createContext(message);

      try {
        const payload = deserialize(message) as TPayload;
        await this.options.handler(payload, context);
      } catch (error) {
        if (this.options.on_error) {
          await this.options.on_error(error, context);
        }
      }

      processed += 1;
      if (this.options.max_messages && processed >= this.options.max_messages) {
        break;
      }
    }

    this.running = false;
  }
}

export class NatsJetStreamConsumer<TPayload = unknown> {
  private subscription?: NatsSubscriptionLike;
  private running = false;
  private runPromise?: Promise<void>;

  public constructor(
    private readonly jetstream: NatsJetStreamClientLike,
    private readonly options: NatsJetStreamConsumerOptions<TPayload>
  ) {}

  public async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    this.subscription = this.jetstream.subscribe(
      this.options.subject,
      this.options.subscribe_options
    );

    this.runPromise = this.processLoop(this.subscription);
    this.runPromise.catch(() => undefined);
  }

  public async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    if (this.subscription) {
      if (this.subscription.drain) {
        await this.subscription.drain();
      } else {
        this.subscription.unsubscribe();
      }
    }

    if (this.runPromise) {
      await this.runPromise;
    }

    this.running = false;
  }

  public isRunning(): boolean {
    return this.running;
  }

  private async processLoop(subscription: NatsSubscriptionLike): Promise<void> {
    const deserialize = this.options.deserialize ?? (defaultDeserializer as any);
    const abortSignal = this.options.abort_signal;
    const autoAck = this.options.auto_ack ?? true;
    const requeueOnError = this.options.requeue_on_error ?? true;
    let processed = 0;

    for await (const message of subscription) {
      if (abortSignal?.aborted) {
        break;
      }

      const context = createContext(message);

      try {
        const payload = deserialize(message) as TPayload;
        await this.options.handler(payload, context);

        if (autoAck) {
          context.ack();
        }
      } catch (error) {
        if (this.options.on_error) {
          await this.options.on_error(error, context);
        }

        if (autoAck) {
          if (requeueOnError) {
            context.nack();
          } else {
            context.term();
          }
        }
      }

      processed += 1;
      if (this.options.max_messages && processed >= this.options.max_messages) {
        break;
      }
    }

    this.running = false;
  }
}
