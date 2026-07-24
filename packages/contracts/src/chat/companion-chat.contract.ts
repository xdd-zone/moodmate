import { z } from "zod";

export const CompanionChatPartSchema = z
  .object({
    type: z.string().trim().min(1),
  })
  .passthrough();

export const CompanionChatMessageSchema = z.object({
  id: z.string().min(1).optional(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(CompanionChatPartSchema).min(1).max(50),
});

export const CompanionChatLlmConfigSchema = z.object({
  providerName: z.string().trim().min(1).max(80),
  baseURL: z
    .url()
    .max(300)
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
      message: "Base URL 必须使用 HTTP 或 HTTPS",
    }),
  model: z.string().trim().min(1).max(120),
  apiKey: z.string().trim().min(1).max(400),
});

export const CompanionChatRequestSchema = z.object({
  conversationId: z.string().min(1).optional(),
  messages: z.array(CompanionChatMessageSchema).min(1).max(20),
});

export const CompanionConversationMessageRoleSchema = z.enum([
  "user",
  "assistant",
]);

export const CompanionMessageFeedbackRatingSchema = z.enum([
  "positive",
  "negative",
]);

export const CompanionMessageFeedbackReasonSchema = z.enum([
  "good_tone",
  "helpful",
  "warm",
  "remembered_context",
  "bad_tone",
  "too_long",
  "too_cold",
  "too_pushy",
  "wrong_memory",
  "unsafe",
  "other",
]);

export const CompanionMessageFeedbackSchema = z.object({
  rating: CompanionMessageFeedbackRatingSchema,
  reason: CompanionMessageFeedbackReasonSchema.nullable(),
  note: z.string().nullable(),
  updatedAtMs: z.number().int().nonnegative(),
});

export const CompanionConversationMessageSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  role: CompanionConversationMessageRoleSchema,
  content: z.string(),
  status: z.enum(["completed", "failed"]),
  createdAtMs: z.number().int().nonnegative(),
  feedback: CompanionMessageFeedbackSchema.nullable(),
});

export const CompanionConversationResponseSchema = z.object({
  conversationId: z.string().min(1),
  title: z.string().nullable(),
  summary: z.string().nullable(),
  messageCount: z.number().int().nonnegative(),
  messages: z.array(CompanionConversationMessageSchema),
  nextCursor: z.string().nullable(),
  hasUnreadCareEvent: z.boolean().default(false),
});

export const CompanionConversationMessagesResponseSchema = z.object({
  messages: z.array(CompanionConversationMessageSchema),
  nextCursor: z.string().nullable(),
});

export const CompanionMemoryStatusSchema = z.enum([
  "active",
  "disabled",
  "deleted",
]);

export const CompanionMemorySourceMessageSchema = z.object({
  id: z.string().min(1),
  role: CompanionConversationMessageRoleSchema,
  content: z.string(),
  createdAtMs: z.number().int().nonnegative(),
});

export const CompanionMemorySchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1).max(80),
  content: z.string().min(1).max(2000),
  importance: z.number().int().min(1).max(5),
  status: CompanionMemoryStatusSchema,
  sourceMessageId: z.string().nullable(),
  sourceMessage: CompanionMemorySourceMessageSchema.nullable(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

export const CompanionMemoriesResponseSchema = z.object({
  items: z.array(CompanionMemorySchema),
});

export const UpdateCompanionMemoryRequestSchema = z
  .object({
    type: z.string().trim().min(1).max(80).optional(),
    content: z.string().trim().min(1).max(2000).optional(),
    importance: z.number().int().min(1).max(5).optional(),
    status: z.enum(["active", "disabled"]).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "至少提供一个需要修改的记忆字段",
  });

export const UpdateCompanionMemoryResponseSchema = z.object({
  memory: CompanionMemorySchema,
});

export const DeleteCompanionMemoryResponseSchema = z.object({
  success: z.literal(true),
});

export const SubmitCompanionMessageFeedbackRequestSchema = z.object({
  rating: CompanionMessageFeedbackRatingSchema,
  reason: CompanionMessageFeedbackReasonSchema.optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export const SubmitCompanionMessageFeedbackResponseSchema = z.object({
  feedback: CompanionMessageFeedbackSchema,
});

export type CompanionChatLlmConfig = z.infer<
  typeof CompanionChatLlmConfigSchema
>;
export type CompanionChatMessage = z.infer<typeof CompanionChatMessageSchema>;
export type CompanionChatRequest = z.infer<typeof CompanionChatRequestSchema>;
export type CompanionConversationMessageRole = z.infer<
  typeof CompanionConversationMessageRoleSchema
>;
export type CompanionConversationMessage = z.infer<
  typeof CompanionConversationMessageSchema
>;
export type CompanionConversationResponse = z.infer<
  typeof CompanionConversationResponseSchema
>;
export type CompanionConversationMessagesResponse = z.infer<
  typeof CompanionConversationMessagesResponseSchema
>;
export type CompanionMemoryStatus = z.infer<typeof CompanionMemoryStatusSchema>;
export type CompanionMemory = z.infer<typeof CompanionMemorySchema>;
export type CompanionMemoriesResponse = z.infer<
  typeof CompanionMemoriesResponseSchema
>;
export type UpdateCompanionMemoryRequest = z.infer<
  typeof UpdateCompanionMemoryRequestSchema
>;
export type UpdateCompanionMemoryResponse = z.infer<
  typeof UpdateCompanionMemoryResponseSchema
>;
export type DeleteCompanionMemoryResponse = z.infer<
  typeof DeleteCompanionMemoryResponseSchema
>;
export type CompanionMessageFeedbackRating = z.infer<
  typeof CompanionMessageFeedbackRatingSchema
>;
export type CompanionMessageFeedbackReason = z.infer<
  typeof CompanionMessageFeedbackReasonSchema
>;
export type CompanionMessageFeedback = z.infer<
  typeof CompanionMessageFeedbackSchema
>;
export type SubmitCompanionMessageFeedbackRequest = z.infer<
  typeof SubmitCompanionMessageFeedbackRequestSchema
>;
export type SubmitCompanionMessageFeedbackResponse = z.infer<
  typeof SubmitCompanionMessageFeedbackResponseSchema
>;
