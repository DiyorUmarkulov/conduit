import type { ConduitBus } from "@conduit/core";

export const createConduitBusProvider = (bus: ConduitBus): {
  provide: string;
  useValue: ConduitBus;
} => ({
  provide: "CONDUIT_BUS",
  useValue: bus
});
