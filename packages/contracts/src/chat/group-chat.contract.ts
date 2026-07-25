import { z } from "zod";

export const AgentGroupChatMemberStatusSchema = z.enum(["active", "removed"]);

export const AgentGroupChatMessageSenderTypeSchema = z.enum([
  "user",
  "agent",
  "system",
]);

export const AgentGroupChatMessageStatusSchema = z.enum([
  "completed",
  "failed",
]);

export const AgentGroupChatMemberSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  name: z.string().min(1),
  headline: z.string().nullable(),
  imageKey: z.string().nullable(),
  status: AgentGroupChatMemberStatusSchema,
  displayOrder: z.number().int().nonnegative(),
  joinedAtMs: z.number().int().nonnegative(),
});

export const AgentGroupChatMessageSchema = z.object({
  id: z.string().min(1),
  groupChatId: z.string().min(1),
  senderType: AgentGroupChatMessageSenderTypeSchema,
  agentId: z.string().nullable(),
  agentName: z.string().nullable(),
  agentImageKey: z.string().nullable(),
  content: z.string(),
  status: AgentGroupChatMessageStatusSchema,
  turnIndex: z.number().int().nonnegative(),
  createdAtMs: z.number().int().nonnegative(),
});

export const AgentGroupChatListItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().nullable(),
  messageCount: z.number().int().nonnegative(),
  lastMessageAtMs: z.number().int().nonnegative().nullable(),
  memberCount: z.number().int().nonnegative(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

export const AgentGroupChatDetailSchema = z.object({
  groupChat: AgentGroupChatListItemSchema,
  members: z.array(AgentGroupChatMemberSchema),
  recentMessages: z.array(AgentGroupChatMessageSchema),
});

export const CreateAgentGroupChatRequestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  agentIds: z.array(z.string().min(1)).min(1).max(6),
});

export const AddAgentGroupChatMembersRequestSchema = z.object({
  agentIds: z.array(z.string().min(1)).min(1).max(6),
});

export const AgentGroupChatListResponseSchema = z.object({
  items: z.array(AgentGroupChatListItemSchema),
});

export const CreateAgentGroupChatResponseSchema = z.object({
  groupChat: AgentGroupChatListItemSchema,
});

export const AgentGroupChatDetailResponseSchema = AgentGroupChatDetailSchema;

export const AgentGroupChatMessagesResponseSchema = z.object({
  items: z.array(AgentGroupChatMessageSchema),
  nextCursor: z.number().int().nonnegative().nullable(),
});

export const AddAgentGroupChatMembersResponseSchema =
  AgentGroupChatDetailSchema;

export const RemoveAgentGroupChatMemberResponseSchema = z.object({
  success: z.literal(true),
  members: z.array(AgentGroupChatMemberSchema),
});

export type AgentGroupChatMemberStatus = z.infer<
  typeof AgentGroupChatMemberStatusSchema
>;
export type AgentGroupChatMessageSenderType = z.infer<
  typeof AgentGroupChatMessageSenderTypeSchema
>;
export type AgentGroupChatMessageStatus = z.infer<
  typeof AgentGroupChatMessageStatusSchema
>;
export type AgentGroupChatMember = z.infer<typeof AgentGroupChatMemberSchema>;
export type AgentGroupChatMessage = z.infer<typeof AgentGroupChatMessageSchema>;
export type AgentGroupChatListItem = z.infer<
  typeof AgentGroupChatListItemSchema
>;
export type AgentGroupChatDetail = z.infer<typeof AgentGroupChatDetailSchema>;
export type CreateAgentGroupChatRequest = z.infer<
  typeof CreateAgentGroupChatRequestSchema
>;
export type AddAgentGroupChatMembersRequest = z.infer<
  typeof AddAgentGroupChatMembersRequestSchema
>;
export type AgentGroupChatListResponse = z.infer<
  typeof AgentGroupChatListResponseSchema
>;
export type CreateAgentGroupChatResponse = z.infer<
  typeof CreateAgentGroupChatResponseSchema
>;
export type AgentGroupChatDetailResponse = z.infer<
  typeof AgentGroupChatDetailResponseSchema
>;
export type AgentGroupChatMessagesResponse = z.infer<
  typeof AgentGroupChatMessagesResponseSchema
>;
export type AddAgentGroupChatMembersResponse = z.infer<
  typeof AddAgentGroupChatMembersResponseSchema
>;
export type RemoveAgentGroupChatMemberResponse = z.infer<
  typeof RemoveAgentGroupChatMemberResponseSchema
>;
