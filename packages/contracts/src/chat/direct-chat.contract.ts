import { z } from "zod";

import { AgentSchema } from "../agents/agent.contract";
import {
  CompanionChatMessageSchema,
  CompanionMessageFeedbackSchema,
  SubmitCompanionMessageFeedbackRequestSchema,
} from "./companion-chat.contract";

export const DirectChatMessageRoleSchema = z.enum(["user", "assistant"]);
export const DirectChatMessageStatusSchema = z.enum(["completed", "failed"]);

export const DirectChatMessageSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  turnId: z.uuid(),
  role: DirectChatMessageRoleSchema,
  content: z.string(),
  status: DirectChatMessageStatusSchema,
  createdAtMs: z.number().int().nonnegative(),
  feedback: CompanionMessageFeedbackSchema.nullable(),
});

export const DirectChatListItemSchema = z.object({
  id: z.uuid(),
  agent: AgentSchema,
  title: z.string().nullable(),
  summary: z.string().nullable(),
  messageCount: z.number().int().nonnegative(),
  lastMessageAtMs: z.number().int().nonnegative().nullable(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

export const DirectChatListResponseSchema = z.object({
  items: z.array(DirectChatListItemSchema),
});

export const CreateDirectChatRequestSchema = z.object({
  agentId: z.uuid(),
});

export const CreateDirectChatResponseSchema = z.object({
  conversation: DirectChatListItemSchema,
  created: z.boolean(),
});

export const DirectChatDetailResponseSchema = z.object({
  conversation: DirectChatListItemSchema,
});

export const DirectChatMessagesResponseSchema = z.object({
  items: z.array(DirectChatMessageSchema),
  nextCursor: z.string().nullable(),
});

export const SendDirectChatMessageRequestSchema = z.object({
  messages: z.array(CompanionChatMessageSchema).min(1).max(20),
});

export const SubmitDirectChatMessageFeedbackRequestSchema =
  SubmitCompanionMessageFeedbackRequestSchema;

export const SubmitDirectChatMessageFeedbackResponseSchema = z.object({
  feedback: CompanionMessageFeedbackSchema,
});

export type DirectChatMessageRole = z.infer<typeof DirectChatMessageRoleSchema>;
export type DirectChatMessageStatus = z.infer<
  typeof DirectChatMessageStatusSchema
>;
export type DirectChatMessage = z.infer<typeof DirectChatMessageSchema>;
export type DirectChatListItem = z.infer<typeof DirectChatListItemSchema>;
export type DirectChatListResponse = z.infer<
  typeof DirectChatListResponseSchema
>;
export type CreateDirectChatRequest = z.infer<
  typeof CreateDirectChatRequestSchema
>;
export type CreateDirectChatResponse = z.infer<
  typeof CreateDirectChatResponseSchema
>;
export type DirectChatDetailResponse = z.infer<
  typeof DirectChatDetailResponseSchema
>;
export type DirectChatMessagesResponse = z.infer<
  typeof DirectChatMessagesResponseSchema
>;
export type SendDirectChatMessageRequest = z.infer<
  typeof SendDirectChatMessageRequestSchema
>;
export type SubmitDirectChatMessageFeedbackRequest = z.infer<
  typeof SubmitDirectChatMessageFeedbackRequestSchema
>;
export type SubmitDirectChatMessageFeedbackResponse = z.infer<
  typeof SubmitDirectChatMessageFeedbackResponseSchema
>;
