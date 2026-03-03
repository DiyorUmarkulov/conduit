import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const currentDir = dirname(fileURLToPath(import.meta.url));
const composeFile = resolve(currentDir, "docker-compose.yml");
const composeProjectName =
  process.env.CONDUIT_E2E_COMPOSE_PROJECT ?? `conduit-e2e-${process.pid}`;

export const setupName = "testcontainers-shared-fixture";

export interface BrokerEndpoints {
  kafka_bootstrap: string;
  rabbitmq_url: string;
  nats_url: string;
  postgres_url: string;
}

export const brokerEndpoints: BrokerEndpoints = {
  kafka_bootstrap: process.env.CONDUIT_KAFKA_BOOTSTRAP ?? "localhost:9092",
  rabbitmq_url: process.env.CONDUIT_RABBITMQ_URL ?? "amqp://localhost:5672",
  nats_url: process.env.CONDUIT_NATS_URL ?? "nats://localhost:4222",
  postgres_url:
    process.env.CONDUIT_POSTGRES_URL ??
    "postgresql://conduit:conduit@localhost:5432/conduit"
};

export const shouldUseBrokerStack = (): boolean =>
  process.env.CONDUIT_E2E_BROKERS === "1";

const dockerCompose = async (args: string[]): Promise<void> => {
  await execFileAsync("docker", ["compose", "-f", composeFile, ...args], {
    env: {
      ...process.env,
      COMPOSE_PROJECT_NAME: composeProjectName
    },
    maxBuffer: 10 * 1024 * 1024
  });
};

export const startBrokerStack = async (): Promise<void> => {
  if (!shouldUseBrokerStack()) {
    return;
  }

  await dockerCompose(["up", "-d", "--wait"]);
};

export const stopBrokerStack = async (): Promise<void> => {
  if (!shouldUseBrokerStack()) {
    return;
  }

  await dockerCompose(["down", "-v"]);
};

export const skipIfNoBrokerStack = (): boolean => !shouldUseBrokerStack();
