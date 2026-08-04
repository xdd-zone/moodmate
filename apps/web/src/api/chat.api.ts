import {
  AgentMemoriesResponseSchema,
  CompanionCareEventsResponseSchema,
  CompanionCarePlanResponseSchema,
  DeleteAgentMemoryResponseSchema,
  GenerateCompanionCareEventResponseSchema,
  UpdateAgentMemoryResponseSchema,
  type GenerateCompanionCareEventRequest,
  type UpdateAgentMemoryRequest,
  type UpsertCompanionCarePlanRequest,
} from "@repo/contracts";

import { http, type HttpRequestOptions } from "@/src/lib/http";

export function getAgentMemories(
  agentId: string,
  options?: HttpRequestOptions,
) {
  return http.get("/rpc/agent-memories", AgentMemoriesResponseSchema, {
    ...options,
    query: { ...options?.query, agentId },
  });
}

export function updateAgentMemory(
  agentId: string,
  memoryId: string,
  input: UpdateAgentMemoryRequest,
  options?: HttpRequestOptions,
) {
  return http.patch(
    `/rpc/agent-memories/${encodeURIComponent(memoryId)}`,
    input,
    UpdateAgentMemoryResponseSchema,
    { ...options, query: { ...options?.query, agentId } },
  );
}

export function deleteAgentMemory(
  agentId: string,
  memoryId: string,
  options?: HttpRequestOptions,
) {
  return http.delete(
    `/rpc/agent-memories/${encodeURIComponent(memoryId)}`,
    DeleteAgentMemoryResponseSchema,
    { ...options, query: { ...options?.query, agentId } },
  );
}

export function getCompanionCarePlan(options?: HttpRequestOptions) {
  return http.get("/rpc/care-plan", CompanionCarePlanResponseSchema, options);
}

export function updateCompanionCarePlan(
  input: UpsertCompanionCarePlanRequest,
  options?: HttpRequestOptions,
) {
  return http.patch(
    "/rpc/care-plan",
    input,
    CompanionCarePlanResponseSchema,
    options,
  );
}

export function getCompanionCareEvents(options?: HttpRequestOptions) {
  return http.get(
    "/rpc/care-events",
    CompanionCareEventsResponseSchema,
    options,
  );
}

export function generateCompanionCareEvent(
  input: GenerateCompanionCareEventRequest,
  options?: HttpRequestOptions,
) {
  return http.post(
    "/rpc/care-events/generate",
    input,
    GenerateCompanionCareEventResponseSchema,
    options,
  );
}
