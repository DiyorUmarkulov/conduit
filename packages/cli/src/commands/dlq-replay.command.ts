import { colors } from "../output/colors.js";
import type { CliOutput } from "../types.js";
import type { ConduitCliConfig } from "../types.js";

export interface DlqReplayCommandInput {
  config: ConduitCliConfig;
  entry_id: string;
  keep?: boolean;
  dry_run?: boolean;
  output: CliOutput;
}

export const runDlqReplayCommand = async ({
  config,
  entry_id: entryId,
  keep,
  dry_run: dryRun,
  output
}: DlqReplayCommandInput): Promise<number> => {
  if (!config.dlq_manager) {
    output.error("DLQ manager is not configured");
    return 1;
  }

  const dlqManager =
    typeof config.dlq_manager === "function"
      ? await Promise.resolve(config.dlq_manager())
      : config.dlq_manager;

  const entries = await dlqManager.list();
  const entry = entries.find((item) => item.id === entryId);

  if (!entry) {
    output.error(`DLQ entry not found: ${entryId}`);
    return 1;
  }

  if (dryRun) {
    output.write(colors.yellow("Dry-run mode. Entry payload is not dispatched."));
    output.write(JSON.stringify(entry, null, 2));
    return 0;
  }

  if (!config.dispatch) {
    output.error("Dispatch function is not configured");
    return 1;
  }

  try {
    await config.dispatch(entry.envelope);

    if (!keep) {
      await dlqManager.remove(entry.id);
      output.write(colors.green(`Replay succeeded and entry removed: ${entry.id}`));
    } else {
      output.write(colors.green(`Replay succeeded and entry retained: ${entry.id}`));
    }

    return 0;
  } catch (error) {
    output.error(`Replay failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
};
