import { z } from "zod";

const AgentMemoryMessageRoleSchema = z.enum(["user", "assistant"]);

export const AgentMemoryStatusSchema = z.enum([
  "active",
  "disabled",
  "deleted",
]);

export const AgentMemorySourceMessageSchema = z.object({
  id: z.uuid(),
  role: AgentMemoryMessageRoleSchema,
  content: z.string(),
  createdAtMs: z.number().int().nonnegative(),
});

export const AgentMemorySchema = z.object({
  id: z.uuid(),
  agentId: z.uuid(),
  type: z.string().min(1).max(80),
  content: z.string().min(1).max(2000),
  importance: z.number().int().min(1).max(5),
  status: AgentMemoryStatusSchema,
  sourceMessageId: z.uuid().nullable(),
  sourceMessage: AgentMemorySourceMessageSchema.nullable(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

export const AgentMemoriesResponseSchema = z.object({
  items: z.array(AgentMemorySchema),
});

export const UpdateAgentMemoryRequestSchema = z
  .object({
    type: z.string().trim().min(1).max(80).optional(),
    content: z.string().trim().min(1).max(2000).optional(),
    importance: z.number().int().min(1).max(5).optional(),
    status: z.enum(["active", "disabled"]).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "至少提供一个需要修改的记忆字段",
  });

export const UpdateAgentMemoryResponseSchema = z.object({
  memory: AgentMemorySchema,
});

export const DeleteAgentMemoryResponseSchema = z.object({
  success: z.literal(true),
});

export type AgentMemoryStatus = z.infer<typeof AgentMemoryStatusSchema>;
export type AgentMemorySourceMessage = z.infer<
  typeof AgentMemorySourceMessageSchema
>;
export type AgentMemory = z.infer<typeof AgentMemorySchema>;
export type AgentMemoriesResponse = z.infer<typeof AgentMemoriesResponseSchema>;
export type UpdateAgentMemoryRequest = z.infer<
  typeof UpdateAgentMemoryRequestSchema
>;
export type UpdateAgentMemoryResponse = z.infer<
  typeof UpdateAgentMemoryResponseSchema
>;
export type DeleteAgentMemoryResponse = z.infer<
  typeof DeleteAgentMemoryResponseSchema
>;
