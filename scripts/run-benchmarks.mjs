import { access, mkdir, symlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

const resolveFromRepo = (...segments) =>
  resolve(currentDir, "..", ...segments);
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const runCommand = (command, args) =>
  new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, {
      cwd: resolveFromRepo(),
      stdio: "inherit"
    });

    child.once("error", rejectCommand);
    child.once("exit", (code) => {
      if (code === 0) {
        resolveCommand();
        return;
      }

      rejectCommand(
        new Error(`${command} ${args.join(" ")} failed with exit code ${code}`)
      );
    });
  });

const pathExists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const ensureBuildArtifacts = async () => {
  const requiredArtifacts = [
    "packages/core/dist/index.js",
    "packages/provider-inmemory/dist/index.js",
    "packages/provider-outbox/dist/index.js"
  ];

  const hasAllArtifacts = (
    await Promise.all(
      requiredArtifacts.map((artifactPath) =>
        pathExists(resolveFromRepo(artifactPath))
      )
    )
  ).every(Boolean);

  if (hasAllArtifacts) {
    return;
  }

  process.stdout.write(
    "Missing build artifacts for benchmarks; building required packages...\n"
  );

  await runCommand(pnpmCommand, [
    "--filter",
    "@conduit/core",
    "--filter",
    "@conduit/provider-inmemory",
    "--filter",
    "@conduit/provider-outbox",
    "build"
  ]);
};

const ensureWorkspaceDependencyLink = async (
  consumerPackagePath,
  dependencyName,
  dependencyTargetPath
) => {
  const dependencyPath = resolveFromRepo(
    consumerPackagePath,
    "node_modules",
    ...dependencyName.split("/")
  );

  await mkdir(dirname(dependencyPath), {
    recursive: true
  });

  try {
    await symlink(
      resolveFromRepo(dependencyTargetPath),
      dependencyPath,
      process.platform === "win32" ? "junction" : "dir"
    );
  } catch (error) {
    if (!(error instanceof Error) || "code" in error === false) {
      throw error;
    }

    if (error.code !== "EEXIST") {
      throw error;
    }
  }
};

const loadRuntimeModules = async () => {
  await ensureBuildArtifacts();
  await ensureWorkspaceDependencyLink(
    "packages/provider-outbox",
    "@conduit/core",
    "packages/core"
  );

  const coreModule = await import(
    pathToFileURL(resolveFromRepo("packages/core/dist/index.js")).href
  );
  const inMemoryModule = await import(
    pathToFileURL(resolveFromRepo("packages/provider-inmemory/dist/index.js")).href
  );
  const outboxModule = await import(
    pathToFileURL(resolveFromRepo("packages/provider-outbox/dist/index.js")).href
  );

  return {
    ConduitBuilder: coreModule.ConduitBuilder,
    EnvelopeBuilder: coreModule.EnvelopeBuilder,
    InMemoryProvider: inMemoryModule.InMemoryProvider,
    InMemoryOutboxAdapter: outboxModule.InMemoryOutboxAdapter,
    OutboxProvider: outboxModule.OutboxProvider,
    OutboxRelay: outboxModule.OutboxRelay
  };
};

const asInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const toOpsPerSecond = (operations, durationMs) => {
  if (durationMs <= 0) {
    return 0;
  }

  return operations / (durationMs / 1000);
};

const percentile = (values, p) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index] ?? 0;
};

const benchmarkDispatchThroughput = async (runtime, EnvelopeBuilder) => {
  const iterations = asInt(process.env.BENCH_DISPATCH_ITERATIONS, 4_000);

  const builder = new runtime.ConduitBuilder();
  builder
    .addRoute(builder.route("order.create").type("COMMAND").via("INMEMORY"))
    .registerProvider(new runtime.InMemoryProvider());

  const bus = builder.build();
  bus.registerCommandHandler("order.create", async () => ({ ok: true }));

  for (let index = 0; index < 200; index += 1) {
    await bus.dispatch(
      EnvelopeBuilder.command("order.create", { order_id: `warmup-${index}` })
        .withSourceService("bench")
        .withIdempotencyKey(`warmup-idem-${index}`)
        .build()
    );
  }

  const started = performance.now();

  for (let index = 0; index < iterations; index += 1) {
    await bus.dispatch(
      EnvelopeBuilder.command("order.create", { order_id: `bench-${index}` })
        .withSourceService("bench")
        .withIdempotencyKey(`bench-idem-${index}`)
        .build()
    );
  }

  const finished = performance.now();
  const durationMs = finished - started;

  return {
    iterations,
    duration_ms: Number(durationMs.toFixed(3)),
    ops_per_sec: Number(toOpsPerSecond(iterations, durationMs).toFixed(2))
  };
};

const benchmarkRoutingLatency = async (runtime, EnvelopeBuilder) => {
  const routesCount = asInt(process.env.BENCH_ROUTE_COUNT, 400);
  const iterations = asInt(process.env.BENCH_ROUTING_ITERATIONS, 2_000);

  const builder = new runtime.ConduitBuilder();
  builder.registerProvider(new runtime.InMemoryProvider());

  for (let index = 0; index < routesCount; index += 1) {
    const operationName = `inventory.segment${index}.updated`;
    builder.addRoute(builder.route(operationName).type("EVENT").via("INMEMORY"));
  }

  const bus = builder.build();

  for (let index = 0; index < routesCount; index += 1) {
    const operationName = `inventory.segment${index}.updated`;
    bus.registerEventHandler(operationName, async () => undefined);
  }

  const latenciesMs = [];
  const started = performance.now();

  for (let index = 0; index < iterations; index += 1) {
    const operationIndex = index % routesCount;
    const operationName = `inventory.segment${operationIndex}.updated`;
    const before = performance.now();

    await bus.dispatch(
      EnvelopeBuilder.event(operationName, {
        sku: `sku-${index}`
      })
        .withSourceService("bench")
        .build()
    );

    const after = performance.now();
    latenciesMs.push(after - before);
  }

  const finished = performance.now();
  const durationMs = finished - started;

  return {
    routes_count: routesCount,
    iterations,
    duration_ms: Number(durationMs.toFixed(3)),
    ops_per_sec: Number(toOpsPerSecond(iterations, durationMs).toFixed(2)),
    p50_ms: Number(percentile(latenciesMs, 50).toFixed(4)),
    p95_ms: Number(percentile(latenciesMs, 95).toFixed(4)),
    p99_ms: Number(percentile(latenciesMs, 99).toFixed(4))
  };
};

const benchmarkSerialization = (EnvelopeBuilder) => {
  const iterations = asInt(process.env.BENCH_SERIALIZATION_ITERATIONS, 120_000);

  const envelope = EnvelopeBuilder.command("payment.charge", {
    payment_id: "p-1",
    amount: 10_500,
    currency: "USD",
    tags: ["card", "3ds", "retryable"],
    metadata: {
      merchant_id: "m-100",
      country: "US"
    }
  })
    .withSourceService("bench")
    .withIdempotencyKey("bench-idempotency-key")
    .build();

  const started = performance.now();

  for (let index = 0; index < iterations; index += 1) {
    const serialized = JSON.stringify(envelope);
    JSON.parse(serialized);
  }

  const finished = performance.now();
  const durationMs = finished - started;

  return {
    iterations,
    duration_ms: Number(durationMs.toFixed(3)),
    json_roundtrip_ops_per_sec: Number(toOpsPerSecond(iterations, durationMs).toFixed(2))
  };
};

const benchmarkOutboxRelay = async (runtime, EnvelopeBuilder) => {
  const operations = asInt(process.env.BENCH_OUTBOX_OPERATIONS, 2_000);

  const adapter = new runtime.InMemoryOutboxAdapter();
  const provider = new runtime.OutboxProvider(adapter);
  const relay = new runtime.OutboxRelay(adapter, provider, {
    batch_size: 500,
    max_parallelism: 8,
    partition_ordering: "BY_PARTITION_KEY"
  });

  const builder = new runtime.ConduitBuilder();
  builder
    .addRoute(builder.route("shipment.reserve").type("COMMAND").via("OUTBOX"))
    .registerProvider(provider);

  const bus = builder.build();
  bus.registerCommandHandler("shipment.reserve", async () => ({ ok: true }));

  for (let index = 0; index < operations; index += 1) {
    await bus.dispatch(
      EnvelopeBuilder.command("shipment.reserve", {
        shipment_id: `s-${index}`,
        order_id: `o-${index % 50}`
      })
        .withSourceService("bench")
        .withIdempotencyKey(`idem-${index}`)
        .build()
    );
  }

  const started = performance.now();

  for (let index = 0; index < 100; index += 1) {
    await relay.runOnce();

    if ((await adapter.pendingCount("shipment.reserve")) === 0) {
      break;
    }
  }

  const finished = performance.now();
  const durationMs = finished - started;

  return {
    operations,
    duration_ms: Number(durationMs.toFixed(3)),
    ops_per_sec: Number(toOpsPerSecond(operations, durationMs).toFixed(2))
  };
};

const main = async () => {
  const runtime = await loadRuntimeModules();
  const { EnvelopeBuilder } = runtime;

  const results = {
    generated_at: new Date().toISOString(),
    node_version: process.version,
    commit_sha: process.env.GITHUB_SHA ?? "local",
    metrics: {
      dispatch: await benchmarkDispatchThroughput(runtime, EnvelopeBuilder),
      routing: await benchmarkRoutingLatency(runtime, EnvelopeBuilder),
      serialization: benchmarkSerialization(EnvelopeBuilder),
      outbox_relay: await benchmarkOutboxRelay(runtime, EnvelopeBuilder)
    }
  };

  const outputPath = resolve(process.cwd(), "benchmarks/results/latest.json");
  await mkdir(dirname(outputPath), {
    recursive: true
  });
  await writeFile(outputPath, JSON.stringify(results, null, 2), "utf8");

  const summary = [
    "Benchmark summary:",
    `dispatch ops/s: ${results.metrics.dispatch.ops_per_sec}`,
    `routing ops/s: ${results.metrics.routing.ops_per_sec}`,
    `routing p95 ms: ${results.metrics.routing.p95_ms}`,
    `json roundtrip ops/s: ${results.metrics.serialization.json_roundtrip_ops_per_sec}`,
    `outbox relay ops/s: ${results.metrics.outbox_relay.ops_per_sec}`,
    `results file: ${outputPath}`
  ].join("\n");

  process.stdout.write(`${summary}\n`);
};

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
