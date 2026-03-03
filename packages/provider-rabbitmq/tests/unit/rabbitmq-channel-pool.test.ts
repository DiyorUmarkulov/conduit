import { EventEmitter } from "node:events";

import { describe, expect, it } from "vitest";

import { RabbitMQChannelPool } from "../../src/rabbitmq-channel-pool.js";

class MockChannel extends EventEmitter {
  public closed = false;
  public constructor(public readonly id: number) {
    super();
  }

  public publish(): boolean {
    return true;
  }

  public async waitForConfirms(): Promise<void> {
    return undefined;
  }

  public async close(): Promise<void> {
    this.closed = true;
  }
}

const pause = async (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

describe("RabbitMQChannelPool", () => {
  it("limits channels and reuses released ones", async () => {
    let created = 0;
    const pool = new RabbitMQChannelPool<MockChannel>(
      {
        createConfirmChannel: async () => new MockChannel(++created)
      },
      {
        size: 2,
        acquire_timeout_ms: 100
      }
    );

    const seen = new Set<number>();
    let releaseFirst: () => void = () => undefined;
    let releaseSecond: () => void = () => undefined;

    const first = pool.withChannel(async (channel) => {
      seen.add(channel.id);
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
    });

    const second = pool.withChannel(async (channel) => {
      seen.add(channel.id);
      await new Promise<void>((resolve) => {
        releaseSecond = resolve;
      });
    });

    await pause(10);
    const third = pool.withChannel(async (channel) => {
      seen.add(channel.id);
    });

    releaseFirst();
    await third;
    releaseSecond();

    await first;
    await second;

    expect(created).toBe(2);
    expect(seen.size).toBe(2);

    await pool.close();
  });

  it("fails acquire when pending queue is saturated", async () => {
    const pool = new RabbitMQChannelPool<MockChannel>(
      {
        createConfirmChannel: async () => new MockChannel(1)
      },
      {
        size: 1,
        max_pending_acquires: 0,
        acquire_timeout_ms: 100
      }
    );

    let releaseFirst: () => void = () => undefined;
    const first = pool.withChannel(async () => {
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
    });

    await pause(10);

    await expect(
      pool.withChannel(async () => {
        return undefined;
      })
    ).rejects.toThrow("saturated");

    releaseFirst();
    await first;
    await pool.close();
  });

  it("times out waiting for available channel", async () => {
    const pool = new RabbitMQChannelPool<MockChannel>(
      {
        createConfirmChannel: async () => new MockChannel(1)
      },
      {
        size: 1,
        max_pending_acquires: 10,
        acquire_timeout_ms: 20
      }
    );

    let releaseFirst: () => void = () => undefined;
    const first = pool.withChannel(async () => {
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
    });

    await pause(5);

    await expect(
      pool.withChannel(async () => {
        return undefined;
      })
    ).rejects.toThrow("Timed out waiting for RabbitMQ channel");

    releaseFirst();
    await first;
    await pool.close();
  });

  it("recreates channel after close event", async () => {
    let created = 0;
    const createdChannels: MockChannel[] = [];
    const pool = new RabbitMQChannelPool<MockChannel>(
      {
        createConfirmChannel: async () => {
          const channel = new MockChannel(++created);
          createdChannels.push(channel);
          return channel;
        }
      },
      {
        size: 1,
        acquire_timeout_ms: 100
      }
    );

    await pool.withChannel(async () => undefined);
    expect(created).toBe(1);

    createdChannels[0]?.emit("close");
    await pause(10);

    await pool.withChannel(async (channel) => {
      expect(channel.id).toBe(2);
    });

    expect(created).toBe(2);
    expect(createdChannels[0]?.closed).toBe(true);

    await pool.close();
  });

  it("waits in-flight work during close and closes channels", async () => {
    let created = 0;
    const createdChannels: MockChannel[] = [];
    const pool = new RabbitMQChannelPool<MockChannel>(
      {
        createConfirmChannel: async () => {
          const channel = new MockChannel(++created);
          createdChannels.push(channel);
          return channel;
        }
      },
      {
        size: 1,
        close_timeout_ms: 200
      }
    );

    let release: () => void = () => undefined;
    const inFlight = pool.withChannel(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });

    await pause(10);
    const closePromise = pool.close();
    await pause(20);

    expect(pool.getStats().closing).toBe(true);

    release();
    await inFlight;
    await closePromise;

    expect(createdChannels[0]?.closed).toBe(true);
    expect(pool.getStats().closed).toBe(true);
  });
});

