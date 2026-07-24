import {
  CompanionCareEventsResponseSchema,
  CompanionCarePlanResponseSchema,
  CompanionConversationMessagesResponseSchema,
  CompanionConversationResponseSchema,
  CompanionMemoriesResponseSchema,
  DeleteCompanionMemoryResponseSchema,
  GenerateCompanionCareEventResponseSchema,
  SubmitCompanionMessageFeedbackResponseSchema,
  UpdateCompanionMemoryResponseSchema,
  type GenerateCompanionCareEventRequest,
  type SubmitCompanionMessageFeedbackRequest,
  type UpdateCompanionMemoryRequest,
  type UpsertCompanionCarePlanRequest,
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

export function getCompanionCarePlan(options?: HttpRequestOptions) {
  return http.get(
    "/rpc/chat/companion/care-plan",
    CompanionCarePlanResponseSchema,
    options,
  );
}

export function updateCompanionCarePlan(
  input: UpsertCompanionCarePlanRequest,
  options?: HttpRequestOptions,
) {
  return http.patch(
    "/rpc/chat/companion/care-plan",
    input,
    CompanionCarePlanResponseSchema,
    options,
  );
}

export function getCompanionCareEvents(options?: HttpRequestOptions) {
  return http.get(
    "/rpc/chat/companion/care-events",
    CompanionCareEventsResponseSchema,
    options,
  );
}

export function generateCompanionCareEvent(
  input: GenerateCompanionCareEventRequest,
  options?: HttpRequestOptions,
) {
  return http.post(
    "/rpc/chat/companion/care-events/generate",
    input,
    GenerateCompanionCareEventResponseSchema,
    options,
  );
}
