import { startBrokerStack, stopBrokerStack } from "./testcontainers-setup.js";

const setup = async (): Promise<() => Promise<void>> => {
  await startBrokerStack();

  return async () => {
    await stopBrokerStack();
  };
};

export default setup;

