export const CONDUIT_BUS_INJECT = Symbol("CONDUIT_BUS_INJECT");

export const InjectConduitBus = (): PropertyDecorator => {
  return (target, propertyKey) => {
    const constructor = target.constructor as unknown as Record<
      string | symbol,
      unknown
    >;
    const current =
      (constructor[CONDUIT_BUS_INJECT] as Array<string | symbol> | undefined) ?? [];

    constructor[CONDUIT_BUS_INJECT] = [...current, propertyKey];
  };
};
