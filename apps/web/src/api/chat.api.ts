import {
  CompanionConversationMessagesResponseSchema,
  CompanionConversationResponseSchema,
  CompanionMemoriesResponseSchema,
  DeleteCompanionMemoryResponseSchema,
  UpdateCompanionMemoryResponseSchema,
  type UpdateCompanionMemoryRequest,
} from "@repo/contracts";

import { http, type HttpRequestOptions } from "@/src/lib/http";

export function getCompanionConversation(options?: HttpRequestOptions) {
  return http.get(
    "/rpc/chat/companion/conversation",
    CompanionConversationResponseSchema,
    options,
  );
}

export function getCompanionConversationMessages(
  cursor: string,
  options?: HttpRequestOptions,
) {
  return http.get(
    "/rpc/chat/companion/messages",
    CompanionConversationMessagesResponseSchema,
    { ...options, query: { ...options?.query, cursor } },
  );
}

export function getCompanionMemories(options?: HttpRequestOptions) {
  return http.get(
    "/rpc/chat/companion/memories",
    CompanionMemoriesResponseSchema,
    options,
  );
}

export function updateCompanionMemory(
  memoryId: string,
  input: UpdateCompanionMemoryRequest,
  options?: HttpRequestOptions,
) {
  return http.patch(
    `/rpc/chat/companion/memories/${encodeURIComponent(memoryId)}`,
    input,
    UpdateCompanionMemoryResponseSchema,
    options,
  );
}

export function deleteCompanionMemory(
  memoryId: string,
  options?: HttpRequestOptions,
) {
  return http.delete(
    `/rpc/chat/companion/memories/${encodeURIComponent(memoryId)}`,
    DeleteCompanionMemoryResponseSchema,
    options,
  );
}
