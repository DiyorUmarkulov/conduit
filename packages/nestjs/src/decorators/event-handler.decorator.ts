export const CONDUIT_EVENT_HANDLER = Symbol("CONDUIT_EVENT_HANDLER");

export interface EventHandlerMetadata {
  operation_name: string;
  version_range?: string;
  consumer_group?: string;
}

export const ConduitEventHandler = (
  operationName: string,
  options: { version_range?: string; consumer_group?: string } = {}
): ClassDecorator => {
  return (target) => {
    Object.defineProperty(target, CONDUIT_EVENT_HANDLER, {
      value: {
        operation_name: operationName,
        ...(options.version_range ? { version_range: options.version_range } : {}),
        ...(options.consumer_group ? { consumer_group: options.consumer_group } : {})
      } satisfies EventHandlerMetadata,
      enumerable: false,
      configurable: false,
      writable: false
    });
  };
};
