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
  messages: z.array(CompanionChatMessageSchema).min(1).max(20),
  llmConfig: CompanionChatLlmConfigSchema.optional(),
});

export type CompanionChatLlmConfig = z.infer<
  typeof CompanionChatLlmConfigSchema
>;
export type CompanionChatMessage = z.infer<typeof CompanionChatMessageSchema>;
export type CompanionChatRequest = z.infer<typeof CompanionChatRequestSchema>;
