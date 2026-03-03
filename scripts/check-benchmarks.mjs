import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const loadJson = async (path) => {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
};

const asNumber = (value, fallback = Number.NaN) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const main = async () => {
  const resultsPath = resolve(
    process.cwd(),
    process.argv[2] ?? "benchmarks/results/latest.json"
  );
  const thresholdsPath = resolve(
    process.cwd(),
    process.argv[3] ?? "benchmarks/thresholds.json"
  );

  const results = await loadJson(resultsPath);
  const thresholds = await loadJson(thresholdsPath);

  const failures = [];

  const dispatchOps = asNumber(results.metrics?.dispatch?.ops_per_sec);
  if (dispatchOps < asNumber(thresholds.dispatch_ops_per_sec_min, 0)) {
    failures.push(
      `dispatch ops/s ${dispatchOps} < min ${thresholds.dispatch_ops_per_sec_min}`
    );
  }

  const routingOps = asNumber(results.metrics?.routing?.ops_per_sec);
  if (routingOps < asNumber(thresholds.routing_ops_per_sec_min, 0)) {
    failures.push(
      `routing ops/s ${routingOps} < min ${thresholds.routing_ops_per_sec_min}`
    );
  }

  const routingP95 = asNumber(results.metrics?.routing?.p95_ms);
  if (routingP95 > asNumber(thresholds.routing_p95_ms_max, Number.POSITIVE_INFINITY)) {
    failures.push(
      `routing p95 ${routingP95}ms > max ${thresholds.routing_p95_ms_max}ms`
    );
  }

  const serializationOps = asNumber(
    results.metrics?.serialization?.json_roundtrip_ops_per_sec
  );
  if (serializationOps < asNumber(thresholds.json_roundtrip_ops_per_sec_min, 0)) {
    failures.push(
      `serialization ops/s ${serializationOps} < min ${thresholds.json_roundtrip_ops_per_sec_min}`
    );
  }

  const outboxOps = asNumber(results.metrics?.outbox_relay?.ops_per_sec);
  if (outboxOps < asNumber(thresholds.outbox_relay_ops_per_sec_min, 0)) {
    failures.push(
      `outbox relay ops/s ${outboxOps} < min ${thresholds.outbox_relay_ops_per_sec_min}`
    );
  }

  if (failures.length > 0) {
    process.stderr.write(
      `Benchmark gate failed:\n${failures.map((entry) => `- ${entry}`).join("\n")}\n`
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write("Benchmark gate passed\n");
};

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
