import { renderTable } from "../output/table.js";
import { colors } from "../output/colors.js";
import type { CliOutput } from "../types.js";
import type { RouteConfig } from "@conduit/core";

export interface RouteListCommandInput {
  routes: RouteConfig[];
  json?: boolean;
  output: CliOutput;
}

export const runRouteListCommand = ({
  routes,
  json,
  output
}: RouteListCommandInput): void => {
  if (json) {
    output.write(JSON.stringify(routes, null, 2));
    return;
  }

  if (routes.length === 0) {
    output.write(colors.yellow("No routes registered"));
    return;
  }

  const table = renderTable(
    [
      { key: "operation_name", header: "Operation" },
      { key: "operation_type", header: "Type" },
      { key: "provider", header: "Provider" },
      { key: "on_exhausted", header: "On Exhausted" }
    ],
    routes.map((route) => ({
      operation_name: route.operation_name,
      operation_type: route.operation_type,
      provider: route.provider,
      on_exhausted: route.on_exhausted
    }))
  );

  output.write(table);
  output.write("");
  output.write(colors.cyan(`Total routes: ${routes.length}`));
};
