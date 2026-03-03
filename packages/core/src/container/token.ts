export type InjectionToken<T> = symbol & { readonly __type?: T };

export const createToken = <T>(description: string): InjectionToken<T> =>
  Symbol(description) as InjectionToken<T>;
