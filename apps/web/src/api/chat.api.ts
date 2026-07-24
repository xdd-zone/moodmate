import {
  CompanionConversationMessagesResponseSchema,
  CompanionConversationResponseSchema,
  CompanionMemoriesResponseSchema,
  DeleteCompanionMemoryResponseSchema,
  SubmitCompanionMessageFeedbackResponseSchema,
  UpdateCompanionMemoryResponseSchema,
  type SubmitCompanionMessageFeedbackRequest,
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

export function submitCompanionMessageFeedback(
  messageId: string,
  input: SubmitCompanionMessageFeedbackRequest,
  options?: HttpRequestOptions,
) {
  return http.post(
    `/rpc/chat/companion/messages/${encodeURIComponent(messageId)}/feedback`,
    input,
    SubmitCompanionMessageFeedbackResponseSchema,
    options,
  );
}
