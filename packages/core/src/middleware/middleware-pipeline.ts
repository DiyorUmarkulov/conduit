import type { OperationEnvelope } from "../types/envelope.js";
import type { RegisteredHandler } from "../types/handler.js";
import type { ITransportProvider } from "../types/provider.js";
import type { RouteConfig } from "../types/route.js";

export interface DispatchContext {
  envelope: OperationEnvelope;
  route: RouteConfig;
  handler: RegisteredHandler;
  provider: ITransportProvider;
  provider_name: string;
}

export type DispatchMiddleware = (
  context: DispatchContext,
  next: () => Promise<void>
) => Promise<void>;

export class MiddlewarePipeline {
  private readonly middlewares: DispatchMiddleware[];

  public constructor(middlewares: DispatchMiddleware[] = []) {
    this.middlewares = [...middlewares];
  }

  public use(middleware: DispatchMiddleware): void {
    this.middlewares.push(middleware);
  }

  public async run(
    context: DispatchContext,
    terminal: () => Promise<void>
  ): Promise<void> {
    let index = -1;

    const invoke = async (position: number): Promise<void> => {
      if (position <= index) {
        throw new Error("next() called multiple times");
      }

      index = position;

      const middleware = this.middlewares[position];

      if (!middleware) {
        await terminal();
        return;
      }

      await middleware(context, async () => invoke(position + 1));
    };

    await invoke(0);
  }
}
