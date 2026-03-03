import type { OperationEnvelope } from "../types/envelope.js";
import type { ICorrelationStore } from "./correlation-store.js";

export interface ReplyListener {
  handleReply(replyEnvelope: OperationEnvelope): boolean;
}

export class CorrelationReplyListener implements ReplyListener {
  public constructor(private readonly store: ICorrelationStore) {}

  public handleReply(replyEnvelope: OperationEnvelope): boolean {
    return this.store.resolve(replyEnvelope);
  }
}
