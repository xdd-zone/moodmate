import {
  AddAgentGroupChatMembersResponseSchema,
  AgentGroupChatDetailResponseSchema,
  AgentGroupChatListResponseSchema,
  AgentGroupChatMessagesResponseSchema,
  CreateAgentGroupChatResponseSchema,
  RemoveAgentGroupChatMemberResponseSchema,
  type AddAgentGroupChatMembersRequest,
  type CreateAgentGroupChatRequest,
} from "@repo/contracts";

import { http, type HttpRequestOptions } from "@/src/lib/http";

export function getGroupChats(options?: HttpRequestOptions) {
  return http.get("/rpc/chat/group", AgentGroupChatListResponseSchema, options);
}

export function getGroupChatDetail(
  groupChatId: string,
  options?: HttpRequestOptions,
) {
  return http.get(
    `/rpc/chat/group/${encodeURIComponent(groupChatId)}`,
    AgentGroupChatDetailResponseSchema,
    options,
  );
}

export function getGroupChatMessages(
  groupChatId: string,
  cursor: number,
  options?: HttpRequestOptions,
) {
  return http.get(
    `/rpc/chat/group/${encodeURIComponent(groupChatId)}/messages`,
    AgentGroupChatMessagesResponseSchema,
    { ...options, query: { ...options?.query, cursor } },
  );
}

export function createGroupChat(
  input: CreateAgentGroupChatRequest,
  options?: HttpRequestOptions,
) {
  return http.post(
    "/rpc/chat/group",
    input,
    CreateAgentGroupChatResponseSchema,
    options,
  );
}

export function addGroupChatMembers(
  groupChatId: string,
  input: AddAgentGroupChatMembersRequest,
  options?: HttpRequestOptions,
) {
  return http.post(
    `/rpc/chat/group/${encodeURIComponent(groupChatId)}/members`,
    input,
    AddAgentGroupChatMembersResponseSchema,
    options,
  );
}

export function removeGroupChatMember(
  groupChatId: string,
  memberId: string,
  options?: HttpRequestOptions,
) {
  return http.delete(
    `/rpc/chat/group/${encodeURIComponent(groupChatId)}/members/${encodeURIComponent(memberId)}`,
    RemoveAgentGroupChatMemberResponseSchema,
    options,
  );
}
