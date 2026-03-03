export const CONDUIT_COMMAND_HANDLER = Symbol("CONDUIT_COMMAND_HANDLER");

export interface CommandHandlerMetadata {
  operation_name: string;
  version_range?: string;
}

export const ConduitCommandHandler = (
  operationName: string,
  options: { version_range?: string } = {}
): ClassDecorator => {
  return (target) => {
    Object.defineProperty(target, CONDUIT_COMMAND_HANDLER, {
      value: {
        operation_name: operationName,
        ...(options.version_range ? { version_range: options.version_range } : {})
      } satisfies CommandHandlerMetadata,
      enumerable: false,
      configurable: false,
      writable: false
    });
  };
};
