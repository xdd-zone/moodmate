import {
  CreateDirectChatRequestSchema,
  CreateDirectChatResponseSchema,
  DirectChatDetailResponseSchema,
  DirectChatListResponseSchema,
  DirectChatMessagesResponseSchema,
  SubmitDirectChatMessageFeedbackRequestSchema,
  SubmitDirectChatMessageFeedbackResponseSchema,
  type SubmitDirectChatMessageFeedbackRequest,
} from "@repo/contracts";
import { http, type HttpRequestOptions } from "@/src/lib/http";
export const getDirectChats = (options?: HttpRequestOptions) =>
  http.get("/rpc/direct-chats", DirectChatListResponseSchema, options);
export const createDirectChat = (
  agentId: string,
  options?: HttpRequestOptions,
) =>
  http.post(
    "/rpc/direct-chats",
    CreateDirectChatRequestSchema.parse({ agentId }),
    CreateDirectChatResponseSchema,
    options,
  );
export const getDirectChat = (
  conversationId: string,
  options?: HttpRequestOptions,
) =>
  http.get(
    `/rpc/direct-chats/${encodeURIComponent(conversationId)}`,
    DirectChatDetailResponseSchema,
    options,
  );
export const getDirectChatMessages = (
  conversationId: string,
  cursor?: string,
  options?: HttpRequestOptions,
) =>
  http.get(
    `/rpc/direct-chats/${encodeURIComponent(conversationId)}/messages`,
    DirectChatMessagesResponseSchema,
    { ...options, query: { cursor } },
  );
export const submitDirectChatFeedback = (
  conversationId: string,
  messageId: string,
  payload: SubmitDirectChatMessageFeedbackRequest,
) =>
  http.post(
    `/rpc/direct-chats/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/feedback`,
    SubmitDirectChatMessageFeedbackRequestSchema.parse(payload),
    SubmitDirectChatMessageFeedbackResponseSchema,
  );
