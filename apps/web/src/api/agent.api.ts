import {
  CreateUserAgentResponseSchema,
  AgentDetailResponseSchema,
  AgentListResponseSchema,
  DeleteUserAgentResponseSchema,
  UpdateUserAgentResponseSchema,
  type CreateUserAgentRequest,
  type UpdateUserAgentRequest,
} from "@repo/contracts";

import { http, type HttpRequestOptions } from "@/src/lib/http";

export function getUserAgents(options?: HttpRequestOptions) {
  return http.get("/rpc/agents", AgentListResponseSchema, options);
}

export function getUserAgentDetail(
  agentId: string,
  options?: HttpRequestOptions,
) {
  return http.get(
    `/rpc/agents/${encodeURIComponent(agentId)}`,
    AgentDetailResponseSchema,
    options,
  );
}

export function createUserAgent(
  input: CreateUserAgentRequest,
  options?: HttpRequestOptions,
) {
  return http.post(
    "/rpc/agents",
    input,
    CreateUserAgentResponseSchema,
    options,
  );
}

export function updateUserAgent(
  agentId: string,
  input: UpdateUserAgentRequest,
  options?: HttpRequestOptions,
) {
  return http.patch(
    `/rpc/agents/${encodeURIComponent(agentId)}`,
    input,
    UpdateUserAgentResponseSchema,
    options,
  );
}

export function deleteUserAgent(agentId: string, options?: HttpRequestOptions) {
  return http.delete(
    `/rpc/agents/${encodeURIComponent(agentId)}`,
    DeleteUserAgentResponseSchema,
    options,
  );
}
