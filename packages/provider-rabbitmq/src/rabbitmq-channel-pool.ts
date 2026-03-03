export interface RabbitMQChannelCloseListener {
  (error?: unknown): void;
}

export interface RabbitMQPooledChannelLike {
  close?(): Promise<void> | void;
  once?(
    event: "close" | "error",
    listener: RabbitMQChannelCloseListener
  ): RabbitMQPooledChannelLike;
  on?(
    event: "close" | "error",
    listener: RabbitMQChannelCloseListener
  ): RabbitMQPooledChannelLike;
  removeListener?(
    event: "close" | "error",
    listener: RabbitMQChannelCloseListener
  ): RabbitMQPooledChannelLike;
}

export interface RabbitMQConnectionLike<
  TChannel extends RabbitMQPooledChannelLike
> {
  createConfirmChannel(): Promise<TChannel>;
}

export interface RabbitMQChannelPoolOptions {
  size?: number;
  max_pending_acquires?: number;
  acquire_timeout_ms?: number;
  close_timeout_ms?: number;
  now?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
}

interface AcquireWaiter<TChannel extends RabbitMQPooledChannelLike> {
  settled: boolean;
  timer: ReturnType<typeof setTimeout>;
  resolve: (channel: TChannel) => void;
  reject: (error: Error) => void;
}

interface AttachedListeners {
  close: RabbitMQChannelCloseListener;
  error: RabbitMQChannelCloseListener;
}

const sleep = async (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

export class RabbitMQChannelPool<TChannel extends RabbitMQPooledChannelLike> {
  private readonly size: number;
  private readonly maxPendingAcquires: number;
  private readonly acquireTimeoutMs: number;
  private readonly closeTimeoutMs: number;
  private readonly now: () => number;
  private readonly sleepFn: (delayMs: number) => Promise<void>;

  private readonly available: TChannel[] = [];
  private readonly inUse = new Set<TChannel>();
  private readonly stale = new Set<TChannel>();
  private readonly waiters: Array<AcquireWaiter<TChannel>> = [];
  private readonly listeners = new Map<TChannel, AttachedListeners>();

  private liveChannels = 0;
  private creatingChannels = 0;
  private closing = false;
  private closed = false;

  public constructor(
    private readonly connection: RabbitMQConnectionLike<TChannel>,
    options: RabbitMQChannelPoolOptions = {}
  ) {
    this.size = Math.max(1, Math.floor(options.size ?? 4));
    this.maxPendingAcquires = Math.max(
      0,
      Math.floor(options.max_pending_acquires ?? this.size * 32)
    );
    this.acquireTimeoutMs = Math.max(
      1,
      Math.floor(options.acquire_timeout_ms ?? 2_000)
    );
    this.closeTimeoutMs = Math.max(1, Math.floor(options.close_timeout_ms ?? 10_000));
    this.now = options.now ?? Date.now;
    this.sleepFn = options.sleep ?? sleep;
  }

  public async withChannel<T>(
    work: (channel: TChannel) => Promise<T>
  ): Promise<T> {
    const channel = await this.acquire();

    try {
      return await work(channel);
    } finally {
      await this.release(channel);
    }
  }

  public async invalidate(channel: TChannel): Promise<void> {
    this.stale.add(channel);
    this.inUse.delete(channel);
    this.removeFromAvailable(channel);
    await this.destroyChannel(channel);
    this.provisionWaitingAcquires();
  }

  public async close(): Promise<void> {
    if (this.closed || this.closing) {
      return;
    }

    this.closing = true;
    this.rejectAllWaiters(
      new Error("RabbitMQ channel pool is closing; cannot acquire channel")
    );

    const deadline = this.now() + this.closeTimeoutMs;
    while (this.inUse.size > 0 && this.now() < deadline) {
      await this.sleepFn(10);
    }

    const toClose = new Set<TChannel>([...this.available, ...this.inUse]);
    await Promise.all([...toClose].map(async (channel) => this.destroyChannel(channel)));

    this.available.length = 0;
    this.inUse.clear();
    this.stale.clear();
    this.liveChannels = 0;
    this.creatingChannels = 0;
    this.closed = true;
    this.closing = false;
  }

  public getStats(): {
    size: number;
    live: number;
    creating: number;
    available: number;
    in_flight: number;
    pending_acquires: number;
    stale: number;
    closing: boolean;
    closed: boolean;
  } {
    return {
      size: this.size,
      live: this.liveChannels,
      creating: this.creatingChannels,
      available: this.available.length,
      in_flight: this.inUse.size,
      pending_acquires: this.waiters.length,
      stale: this.stale.size,
      closing: this.closing,
      closed: this.closed
    };
  }

  private async acquire(): Promise<TChannel> {
    if (this.closed || this.closing) {
      throw new Error("RabbitMQ channel pool is closed");
    }

    const availableChannel = this.takeAvailableChannel();

    if (availableChannel) {
      this.inUse.add(availableChannel);
      return availableChannel;
    }

    if (this.liveChannels + this.creatingChannels < this.size) {
      return this.createAndAcquireChannel();
    }

    if (this.waiters.length >= this.maxPendingAcquires) {
      throw new Error("RabbitMQ channel pool is saturated");
    }

    return new Promise((resolve, reject) => {
      let waiter: AcquireWaiter<TChannel>;
      const timer = setTimeout(() => {
        this.removeWaiter(waiter);
        waiter.reject(
          new Error(
            `Timed out waiting for RabbitMQ channel after ${this.acquireTimeoutMs}ms`
          )
        );
      }, this.acquireTimeoutMs);

      waiter = {
        settled: false,
        timer,
        resolve: (channel) => {
          if (waiter.settled) {
            return;
          }

          waiter.settled = true;
          clearTimeout(waiter.timer);
          resolve(channel);
        },
        reject: (error) => {
          if (waiter.settled) {
            return;
          }

          waiter.settled = true;
          clearTimeout(waiter.timer);
          reject(error);
        }
      };

      this.waiters.push(waiter);
      this.provisionWaitingAcquires();
    });
  }

  private async createAndAcquireChannel(): Promise<TChannel> {
    this.creatingChannels += 1;

    try {
      const channel = await this.connection.createConfirmChannel();

      if (this.closed || this.closing) {
        await this.destroyChannel(channel);
        throw new Error("RabbitMQ channel pool is closed");
      }

      this.attachLifecycleListeners(channel);
      this.liveChannels += 1;
      this.inUse.add(channel);
      return channel;
    } catch (error) {
      throw asError(error);
    } finally {
      this.creatingChannels -= 1;
      this.provisionWaitingAcquires();
    }
  }

  private async release(channel: TChannel): Promise<void> {
    if (!this.inUse.has(channel)) {
      return;
    }

    this.inUse.delete(channel);

    if (this.closed || this.closing || this.stale.has(channel)) {
      await this.destroyChannel(channel);
      this.provisionWaitingAcquires();
      return;
    }

    const waiter = this.takeNextWaiter();

    if (!waiter) {
      this.available.push(channel);
      return;
    }

    this.inUse.add(channel);
    waiter.resolve(channel);
  }

  private takeAvailableChannel(): TChannel | undefined {
    while (this.available.length > 0) {
      const channel = this.available.pop();

      if (!channel) {
        continue;
      }

      if (this.stale.has(channel)) {
        void this.destroyChannel(channel);
        continue;
      }

      return channel;
    }

    return undefined;
  }

  private takeNextWaiter(): AcquireWaiter<TChannel> | undefined {
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();

      if (!waiter || waiter.settled) {
        continue;
      }

      return waiter;
    }

    return undefined;
  }

  private removeWaiter(waiter: AcquireWaiter<TChannel>): void {
    const index = this.waiters.indexOf(waiter);

    if (index >= 0) {
      this.waiters.splice(index, 1);
    }
  }

  private rejectAllWaiters(error: Error): void {
    const waiters = [...this.waiters];
    this.waiters.length = 0;

    for (const waiter of waiters) {
      waiter.reject(error);
    }
  }

  private provisionWaitingAcquires(): void {
    while (
      this.waiters.length > 0 &&
      !this.closed &&
      !this.closing &&
      this.liveChannels + this.creatingChannels < this.size
    ) {
      const waiter = this.takeNextWaiter();

      if (!waiter) {
        return;
      }

      this.creatingChannels += 1;

      void this.connection
        .createConfirmChannel()
        .then((channel) => {
          if (this.closed || this.closing) {
            void this.destroyChannel(channel);
            waiter.reject(new Error("RabbitMQ channel pool is closed"));
            return;
          }

          this.attachLifecycleListeners(channel);
          this.liveChannels += 1;
          this.inUse.add(channel);
          waiter.resolve(channel);
        })
        .catch((error) => {
          waiter.reject(asError(error));
        })
        .finally(() => {
          this.creatingChannels -= 1;
          this.provisionWaitingAcquires();
        });
    }
  }

  private attachLifecycleListeners(channel: TChannel): void {
    const closeListener = (): void => {
      this.markStale(channel);
    };
    const errorListener = (): void => {
      this.markStale(channel);
    };

    if (channel.once) {
      channel.once("close", closeListener);
      channel.once("error", errorListener);
    } else if (channel.on) {
      channel.on("close", closeListener);
      channel.on("error", errorListener);
    }

    this.listeners.set(channel, {
      close: closeListener,
      error: errorListener
    });
  }

  private markStale(channel: TChannel): void {
    this.stale.add(channel);

    if (this.inUse.has(channel)) {
      return;
    }

    this.removeFromAvailable(channel);
    void this.destroyChannel(channel).finally(() => {
      this.provisionWaitingAcquires();
    });
  }

  private removeFromAvailable(channel: TChannel): void {
    const index = this.available.indexOf(channel);

    if (index >= 0) {
      this.available.splice(index, 1);
    }
  }

  private async destroyChannel(channel: TChannel): Promise<void> {
    const known =
      this.listeners.has(channel) ||
      this.inUse.has(channel) ||
      this.available.includes(channel);

    const listeners = this.listeners.get(channel);

    if (listeners && channel.removeListener) {
      channel.removeListener("close", listeners.close);
      channel.removeListener("error", listeners.error);
    }

    this.listeners.delete(channel);
    this.stale.delete(channel);
    this.inUse.delete(channel);
    this.removeFromAvailable(channel);

    if (known && this.liveChannels > 0) {
      this.liveChannels -= 1;
    }

    if (channel.close) {
      try {
        await channel.close();
      } catch {
        // Swallow close errors: channel is already unusable.
      }
    }
  }
}
