import type {
  CompanionConversationMessage,
  CompanionMemory,
} from "@repo/contracts";

import type {
  CompanionConversationMessageRecord,
  CompanionMemoryRecord,
} from "./chat.schema";

export function presentCompanionConversationMessage(
  message: CompanionConversationMessageRecord,
): CompanionConversationMessage {
  return {
    content: message.content,
    conversationId: message.conversationId,
    createdAtMs: message.createdAtMs,
    id: message.id,
    role: message.role,
    status: message.status,
  };
}

export function presentCompanionMemory(
  memory: CompanionMemoryRecord,
): CompanionMemory {
  return {
    content: memory.content,
    createdAtMs: memory.createdAtMs,
    id: memory.id,
    importance: memory.importance,
    sourceMessage: null,
    sourceMessageId: memory.sourceMessageId,
    status: memory.status,
    type: memory.type,
    updatedAtMs: memory.updatedAtMs,
  };
}

export function presentCompanionMemoryWithSource(memory: {
  content: string;
  createdAtMs: number;
  id: string;
  importance: number;
  sourceMessageContent: string | null;
  sourceMessageCreatedAtMs: number | null;
  sourceMessageId: string | null;
  sourceMessageRole: "assistant" | "user" | null;
  status: "active" | "deleted" | "disabled";
  type: string;
  updatedAtMs: number;
}): CompanionMemory {
  let sourceMessage: CompanionMemory["sourceMessage"] = null;

  if (
    memory.sourceMessageId !== null &&
    memory.sourceMessageRole !== null &&
    memory.sourceMessageContent !== null &&
    memory.sourceMessageCreatedAtMs !== null
  ) {
    sourceMessage = {
      content: memory.sourceMessageContent,
      createdAtMs: memory.sourceMessageCreatedAtMs,
      id: memory.sourceMessageId,
      role: memory.sourceMessageRole,
    };
  }

  return {
    content: memory.content,
    createdAtMs: memory.createdAtMs,
    id: memory.id,
    importance: memory.importance,
    sourceMessage,
    sourceMessageId: memory.sourceMessageId,
    status: memory.status,
    type: memory.type,
    updatedAtMs: memory.updatedAtMs,
  };
}
