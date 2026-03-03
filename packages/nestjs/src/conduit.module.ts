import type { ConduitBus } from "@conduit/core";

export interface ConduitModuleOptions {
  bus: ConduitBus;
}

export interface ConduitModuleDefinition {
  module: "ConduitModule";
  providers: {
    token: string;
    value: unknown;
  }[];
  exports: string[];
}

export const createConduitModule = (
  options: ConduitModuleOptions
): ConduitModuleDefinition => ({
  module: "ConduitModule",
  providers: [
    {
      token: "CONDUIT_BUS",
      value: options.bus
    }
  ],
  exports: ["CONDUIT_BUS"]
});
