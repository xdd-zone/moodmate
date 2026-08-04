import { z } from "zod";

export const AgentSourceSchema = z.enum(["system", "user"]);
export const AgentStatusSchema = z.enum(["active", "disabled", "archived"]);

export const AgentSchema = z.object({
  id: z.uuid(),
  source: AgentSourceSchema,
  ownerUserId: z.uuid().nullable(),
  name: z.string().min(1).max(120),
  headline: z.string().nullable(),
  description: z.string().nullable(),
  storyBackground: z.string().nullable(),
  personaPrompt: z.string().nullable(),
  tonePrompt: z.string().nullable(),
  guardrailsPrompt: z.string().nullable(),
  defaultPrompt: z.string().nullable(),
  imageKey: z.string().nullable(),
  status: AgentStatusSchema,
  editable: z.boolean(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

export const AgentListResponseSchema = z.object({
  items: z.array(AgentSchema),
});

export const AgentDetailResponseSchema = z.object({
  agent: AgentSchema,
});

export const UserAgentStatusSchema = z.enum(["active", "archived"]);

export const UserAgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  headline: z.string().nullable(),
  description: z.string().nullable(),
  storyBackground: z.string().nullable(),
  personaPrompt: z.string().nullable(),
  tonePrompt: z.string().nullable(),
  guardrailsPrompt: z.string().nullable(),
  defaultPrompt: z.string().nullable(),
  imageKey: z.string().nullable(),
  status: UserAgentStatusSchema,
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

const optionalPromptField = (max: number) =>
  z.string().trim().max(max).optional().nullable();

export const CreateUserAgentRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  headline: optionalPromptField(200),
  description: optionalPromptField(2000),
  storyBackground: optionalPromptField(4000),
  personaPrompt: optionalPromptField(4000),
  tonePrompt: optionalPromptField(2000),
  guardrailsPrompt: optionalPromptField(2000),
  defaultPrompt: optionalPromptField(4000),
  imageKey: z.string().trim().max(300).optional().nullable(),
});

export const UpdateUserAgentRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    headline: optionalPromptField(200),
    description: optionalPromptField(2000),
    storyBackground: optionalPromptField(4000),
    personaPrompt: optionalPromptField(4000),
    tonePrompt: optionalPromptField(2000),
    guardrailsPrompt: optionalPromptField(2000),
    defaultPrompt: optionalPromptField(4000),
    imageKey: z.string().trim().max(300).optional().nullable(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "至少提供一个需要修改的字段",
  });

export const UserAgentListResponseSchema = z.object({
  items: z.array(UserAgentSchema),
});

export const UserAgentDetailResponseSchema = z.object({
  agent: UserAgentSchema,
});

export const CreateUserAgentResponseSchema = z.object({
  agent: UserAgentSchema,
});

export const UpdateUserAgentResponseSchema = z.object({
  agent: UserAgentSchema,
});

export const DeleteUserAgentResponseSchema = z.object({
  success: z.literal(true),
});

export type UserAgentStatus = z.infer<typeof UserAgentStatusSchema>;
export type AgentSource = z.infer<typeof AgentSourceSchema>;
export type AgentStatus = z.infer<typeof AgentStatusSchema>;
export type Agent = z.infer<typeof AgentSchema>;
export type AgentListResponse = z.infer<typeof AgentListResponseSchema>;
export type AgentDetailResponse = z.infer<typeof AgentDetailResponseSchema>;
export type UserAgent = z.infer<typeof UserAgentSchema>;
export type CreateUserAgentRequest = z.infer<
  typeof CreateUserAgentRequestSchema
>;
export type UpdateUserAgentRequest = z.infer<
  typeof UpdateUserAgentRequestSchema
>;
export type UserAgentListResponse = z.infer<typeof UserAgentListResponseSchema>;
export type UserAgentDetailResponse = z.infer<
  typeof UserAgentDetailResponseSchema
>;
export type CreateUserAgentResponse = z.infer<
  typeof CreateUserAgentResponseSchema
>;
export type UpdateUserAgentResponse = z.infer<
  typeof UpdateUserAgentResponseSchema
>;
export type DeleteUserAgentResponse = z.infer<
  typeof DeleteUserAgentResponseSchema
>;
