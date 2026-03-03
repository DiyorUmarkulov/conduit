import { Socket } from "node:net";
import { afterAll, beforeAll, describe, it } from "vitest";

import {
  brokerEndpoints,
  skipIfNoBrokerStack,
  startBrokerStack,
  stopBrokerStack
} from "../infrastructure/testcontainers-setup.js";

const parseHostAndPort = (value: string): { host: string; port: number } => {
  const [host, port] = value.split(":");
  const parsedPort = Number.parseInt(port ?? "", 10);

  if (!host || !Number.isFinite(parsedPort) || parsedPort <= 0) {
    throw new Error(`Invalid host:port value: ${value}`);
  }

  return { host, port: parsedPort };
};

const parseUrlEndpoint = (
  value: string,
  defaultPort: number
): { host: string; port: number } => {
  const parsed = new URL(value);
  const port =
    parsed.port.length > 0 ? Number.parseInt(parsed.port, 10) : defaultPort;

  if (!parsed.hostname || !Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid URL endpoint: ${value}`);
  }

  return {
    host: parsed.hostname,
    port
  };
};

const assertTcpReachable = async (
  label: string,
  host: string,
  port: number,
  timeoutMs = 5_000
): Promise<void> =>
  new Promise((resolve, reject) => {
    const socket = new Socket();
    let settled = false;

    const finish = (callback: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      callback();
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(resolve));
    socket.once("timeout", () =>
      finish(() =>
        reject(
          new Error(
            `${label} is unreachable at ${host}:${port}: timeout ${timeoutMs}ms`
          )
        )
      )
    );
    socket.once("error", (error) =>
      finish(() =>
        reject(
          new Error(
            `${label} is unreachable at ${host}:${port}: ${error.message}`
          )
        )
      )
    );
    socket.connect(port, host);
  });

describe("E2E broker-stack smoke", () => {
  beforeAll(async () => {
    await startBrokerStack();
  });

  afterAll(async () => {
    await stopBrokerStack();
  });

  it.skipIf(skipIfNoBrokerStack())(
    "accepts TCP connections for all configured broker endpoints",
    async () => {
      const kafka = parseHostAndPort(brokerEndpoints.kafka_bootstrap);
      const rabbitmq = parseUrlEndpoint(brokerEndpoints.rabbitmq_url, 5672);
      const nats = parseUrlEndpoint(brokerEndpoints.nats_url, 4222);
      const postgres = parseUrlEndpoint(brokerEndpoints.postgres_url, 5432);

      await Promise.all([
        assertTcpReachable("kafka", kafka.host, kafka.port),
        assertTcpReachable("rabbitmq", rabbitmq.host, rabbitmq.port),
        assertTcpReachable("nats", nats.host, nats.port),
        assertTcpReachable("postgres", postgres.host, postgres.port)
      ]);
    }
  );
});
