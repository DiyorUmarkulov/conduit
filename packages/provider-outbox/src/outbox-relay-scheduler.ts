import { OutboxRelay } from "./outbox-relay.js";

export interface OutboxRelaySchedulerOptions {
  poll_interval_ms?: number;
  sleep?: (delayMs: number) => Promise<void>;
  on_error?: (error: unknown) => void;
}

const sleep = async (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

export class OutboxRelayScheduler {
  private readonly pollIntervalMs: number;
  private readonly sleepFn: (delayMs: number) => Promise<void>;
  private loopPromise: Promise<void> | undefined;
  private stopRequested = false;

  public constructor(
    private readonly relay: OutboxRelay,
    private readonly options: OutboxRelaySchedulerOptions = {}
  ) {
    this.pollIntervalMs = Math.max(10, options.poll_interval_ms ?? 100);
    this.sleepFn = options.sleep ?? sleep;
  }

  public start(): void {
    if (this.loopPromise) {
      return;
    }

    this.stopRequested = false;
    this.loopPromise = this.loop();
  }

  public async stop(): Promise<void> {
    this.stopRequested = true;

    if (this.loopPromise) {
      await this.loopPromise;
      this.loopPromise = undefined;
    }
  }

  public isRunning(): boolean {
    return this.loopPromise !== undefined;
  }

  private async loop(): Promise<void> {
    while (!this.stopRequested) {
      try {
        await this.relay.runOnce();
      } catch (error) {
        if (this.options.on_error) {
          this.options.on_error(error);
        }
      }

      await this.sleepFn(this.pollIntervalMs);
    }
  }
}
