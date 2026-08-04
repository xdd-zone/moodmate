import { z } from "zod";

import {
  AgentSourceSchema,
  AgentStatusSchema,
  AgentSchema,
} from "../agents/agent.contract";
import { LlmConfigApiSchema } from "../llm/llm-config.contract";
import {
  UserRoleSchema,
  UserStatusSchema,
} from "../auth/user-management.contract";

export const AdminAgentSchema = AgentSchema.omit({ editable: true });

export const AiCallScenarioSchema = z.enum([
  "direct_safety_analysis",
  "direct_intent_analysis",
  "direct_emotion_analysis",
  "direct_relationship_analysis",
  "direct_reply",
  "direct_memory_judgement",
  "direct_memory_extraction",
  "direct_care_generation",
  "group_intent_analysis",
  "group_emotion_analysis",
  "group_agent_selection",
  "group_agent_reply",
  "group_cross_reply_plan",
  "group_cross_reply",
  "group_reply_quality",
  "llm_config_test",
]);

export const AiCallStatusSchema = z.enum([
  "started",
  "completed",
  "failed",
  "aborted",
]);
export const AiUsageStatusSchema = z.enum([
  "pending",
  "reported",
  "unavailable",
]);
export const AiCallSubjectTypeSchema = z.enum(["agent", "system"]);
export const AiCallConversationTypeSchema = z.enum(["direct", "group", "none"]);

export const TokenUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  callCount: z.number().int().nonnegative(),
});

export const AdminAiUsageSubjectSchema = z.object({
  subjectType: AiCallSubjectTypeSchema,
  agentId: z.uuid().nullable(),
  agentName: z.string().nullable(),
  agentSource: AgentSourceSchema.nullable(),
  total: TokenUsageSchema,
  today: TokenUsageSchema,
  lastCalledAtMs: z.number().int().nonnegative().nullable(),
});

export const AdminUserAiUsageResponseSchema = z.object({
  userId: z.uuid(),
  interval: z.object({
    startAtMs: z.number().int().nonnegative(),
    endAtMs: z.number().int().nonnegative(),
    timeZone: z.literal("Asia/Shanghai"),
  }),
  total: TokenUsageSchema,
  today: TokenUsageSchema,
  failedCallCount: z.number().int().nonnegative(),
  lastCalledAtMs: z.number().int().nonnegative().nullable(),
  subjects: z.array(AdminAiUsageSubjectSchema),
});

export const AdminAiCallListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  startAtMs: z.coerce.number().int().nonnegative().optional(),
  endAtMs: z.coerce.number().int().nonnegative().optional(),
  agentId: z.uuid().optional(),
  scenario: AiCallScenarioSchema.optional(),
  model: z.string().trim().max(120).optional(),
  status: AiCallStatusSchema.optional(),
});

export const AdminAiCallListItemSchema = z.object({
  id: z.uuid(),
  requestId: z.string().min(1),
  startedAtMs: z.number().int().nonnegative(),
  scenario: AiCallScenarioSchema,
  subjectType: AiCallSubjectTypeSchema,
  agentId: z.uuid().nullable(),
  agentName: z.string().nullable(),
  conversationType: AiCallConversationTypeSchema,
  conversationId: z.uuid().nullable(),
  api: LlmConfigApiSchema,
  providerName: z.string().min(1),
  model: z.string().min(1),
  promptTokens: z.number().int().nonnegative().nullable(),
  completionTokens: z.number().int().nonnegative().nullable(),
  totalTokens: z.number().int().nonnegative().nullable(),
  usageStatus: AiUsageStatusSchema,
  durationMs: z.number().int().nonnegative().nullable(),
  status: AiCallStatusSchema,
  errorCode: z.string().nullable(),
  /** 上游原始报错文本（截断）。只含协议层报错，不含 prompt 与模型回复。 */
  errorMessage: z.string().nullable(),
});

export const AdminAiCallListResponseSchema = z.object({
  items: z.array(AdminAiCallListItemSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const AdminOverviewResponseSchema = z.object({
  generatedAtMs: z.number().int().nonnegative(),
  interval: z.object({
    startAtMs: z.number().int().nonnegative(),
    endAtMs: z.number().int().nonnegative(),
    timeZone: z.literal("Asia/Shanghai"),
  }),
  users: z.object({
    total: z.number().int().nonnegative(),
    createdToday: z.number().int().nonnegative(),
    activeToday: z.number().int().nonnegative(),
  }),
  agents: z.object({
    system: z.number().int().nonnegative(),
    user: z.number().int().nonnegative(),
  }),
  conversations: z.object({
    direct: z.number().int().nonnegative(),
    group: z.number().int().nonnegative(),
  }),
  messages: z.object({
    total: z.number().int().nonnegative(),
    today: z.number().int().nonnegative(),
  }),
  aiCalls: z.object({
    total: z.number().int().nonnegative(),
    today: z.number().int().nonnegative(),
    failedToday: z.number().int().nonnegative(),
    failureRateToday: z.number().min(0).max(1),
  }),
  tokens: z.object({
    total: z.number().int().nonnegative(),
    today: z.number().int().nonnegative(),
  }),
  trendPeriodDays: z.literal(7),
  trend: z.array(
    z.object({
      date: z.iso.date(),
      startAtMs: z.number().int().nonnegative(),
      messageCount: z.number().int().nonnegative(),
      aiCallCount: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative(),
    }),
  ),
  topUsers: z.array(
    z.object({
      userId: z.uuid(),
      displayName: z.string().min(1),
      email: z.email(),
      totalTokens: z.number().int().nonnegative(),
      callCount: z.number().int().nonnegative(),
    }),
  ),
  topAgents: z.array(
    z.object({
      agentId: z.uuid(),
      name: z.string().min(1),
      source: AgentSourceSchema,
      totalTokens: z.number().int().nonnegative(),
      callCount: z.number().int().nonnegative(),
    }),
  ),
  recentFailures: z.array(
    z.object({
      id: z.uuid(),
      startedAtMs: z.number().int().nonnegative(),
      scenario: AiCallScenarioSchema,
      providerName: z.string().min(1),
      model: z.string().min(1),
      errorCode: z.string().nullable(),
      errorMessage: z.string().nullable(),
      requestId: z.string().min(1),
    }),
  ),
});

export const AdminUserDetailResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    displayName: z.string().min(1),
    email: z.email(),
    status: UserStatusSchema,
    roles: z.array(UserRoleSchema),
    createdAtMs: z.number().int().nonnegative(),
    lastLoginAtMs: z.number().int().nonnegative().nullable(),
    lastActiveAtMs: z.number().int().nonnegative().nullable(),
  }),
  summary: z.object({
    friendCount: z.number().int().nonnegative(),
    directConversationCount: z.number().int().nonnegative(),
    directMessageCount: z.number().int().nonnegative(),
    groupConversationCount: z.number().int().nonnegative(),
    groupMessageCount: z.number().int().nonnegative(),
    aiCallCount: z.number().int().nonnegative(),
    failedAiCallCount: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  }),
  friends: z.array(
    z.object({
      id: z.uuid(),
      name: z.string().min(1),
      source: AgentSourceSchema,
      status: AgentStatusSchema,
      conversationId: z.uuid().nullable(),
      messageCount: z.number().int().nonnegative(),
      lastActiveAtMs: z.number().int().nonnegative().nullable(),
    }),
  ),
  groupChats: z.array(
    z.object({
      id: z.uuid(),
      title: z.string().min(1),
      messageCount: z.number().int().nonnegative(),
      lastActiveAtMs: z.number().int().nonnegative().nullable(),
    }),
  ),
});

export const AdminAgentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  source: AgentSourceSchema.optional(),
  status: AgentStatusSchema.optional(),
  keyword: z.string().trim().max(120).optional(),
});

export const AdminAgentListItemSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  source: AgentSourceSchema,
  ownerUserId: z.uuid().nullable(),
  ownerDisplayName: z.string().nullable(),
  ownerEmail: z.email().nullable(),
  status: AgentStatusSchema,
  userCount: z.number().int().nonnegative(),
  conversationCount: z.number().int().nonnegative(),
  messageCount: z.number().int().nonnegative(),
  memoryCount: z.number().int().nonnegative(),
  groupCount: z.number().int().nonnegative(),
  lastUsedAtMs: z.number().int().nonnegative().nullable(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

export const AdminAgentListResponseSchema = z.object({
  items: z.array(AdminAgentListItemSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

const optionalAgentText = (max: number) =>
  z.string().trim().max(max).optional().nullable();

export const AdminSystemAgentMutationRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  headline: optionalAgentText(200),
  description: optionalAgentText(2000),
  storyBackground: optionalAgentText(4000),
  personaPrompt: optionalAgentText(4000),
  tonePrompt: optionalAgentText(2000),
  guardrailsPrompt: optionalAgentText(2000),
  defaultPrompt: optionalAgentText(4000),
  imageKey: z.string().trim().max(300).optional().nullable(),
});

export const AdminSystemAgentUpdateRequestSchema =
  AdminSystemAgentMutationRequestSchema.partial().refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    { message: "至少提供一个需要修改的字段" },
  );

export const AdminAgentDetailResponseSchema = z.object({
  agent: AdminAgentSchema,
  stats: z.object({
    userCount: z.number().int().nonnegative(),
    conversationCount: z.number().int().nonnegative(),
    messageCount: z.number().int().nonnegative(),
    memoryCount: z.number().int().nonnegative(),
    groupCount: z.number().int().nonnegative(),
    aiCallCount: z.number().int().nonnegative(),
    lastUsedAtMs: z.number().int().nonnegative().nullable(),
  }),
});

export const AdminSystemAgentMutationResponseSchema = z.object({
  agent: AdminAgentSchema,
});

export const AdminSystemAgentDeleteResponseSchema = z.object({
  success: z.literal(true),
});

export const AdminMessageFeedbackListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  rating: z.enum(["positive", "negative"]).optional(),
  status: z.enum(["pending", "processed"]).optional(),
});

export const AdminMessageFeedbackStatusSchema = z.enum([
  "pending",
  "processed",
]);

export const AdminMessageFeedbackListItemSchema = z.object({
  id: z.uuid(),
  submittedAtMs: z.number().int().nonnegative(),
  userId: z.uuid(),
  userDisplayName: z.string(),
  agentId: z.uuid(),
  agentName: z.string(),
  rating: z.enum(["positive", "negative"]),
  reason: z.string().nullable(),
  note: z.string().nullable(),
  status: AdminMessageFeedbackStatusSchema,
  processedAtMs: z.number().int().nonnegative().nullable(),
  processedByDisplayName: z.string().nullable(),
});

export const AdminMessageFeedbackListResponseSchema = z.object({
  items: z.array(AdminMessageFeedbackListItemSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const AdminMessageFeedbackDetailResponseSchema = z.object({
  feedback: AdminMessageFeedbackListItemSchema,
  userMessage: z.object({
    id: z.uuid(),
    content: z.string(),
    createdAtMs: z.number().int().nonnegative(),
  }),
  assistantMessage: z.object({
    id: z.uuid(),
    content: z.string(),
    createdAtMs: z.number().int().nonnegative(),
  }),
});

export const AdminMessageFeedbackUpdateRequestSchema = z.object({
  status: AdminMessageFeedbackStatusSchema,
});

export const AdminMessageFeedbackUpdateResponseSchema = z.object({
  feedback: AdminMessageFeedbackListItemSchema,
});

export type AiCallScenario = z.infer<typeof AiCallScenarioSchema>;
export type AiCallStatus = z.infer<typeof AiCallStatusSchema>;
export type AiUsageStatus = z.infer<typeof AiUsageStatusSchema>;
export type AiCallSubjectType = z.infer<typeof AiCallSubjectTypeSchema>;
export type AiCallConversationType = z.infer<
  typeof AiCallConversationTypeSchema
>;
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
export type AdminAiUsageSubject = z.infer<typeof AdminAiUsageSubjectSchema>;
export type AdminUserAiUsageResponse = z.infer<
  typeof AdminUserAiUsageResponseSchema
>;
export type AdminAiCallListQuery = z.infer<typeof AdminAiCallListQuerySchema>;
export type AdminAiCallListItem = z.infer<typeof AdminAiCallListItemSchema>;
export type AdminAiCallListResponse = z.infer<
  typeof AdminAiCallListResponseSchema
>;
export type AdminOverviewResponse = z.infer<typeof AdminOverviewResponseSchema>;
export type AdminUserDetailResponse = z.infer<
  typeof AdminUserDetailResponseSchema
>;
export type AdminAgentListQuery = z.infer<typeof AdminAgentListQuerySchema>;
export type AdminAgent = z.infer<typeof AdminAgentSchema>;
export type AdminAgentListItem = z.infer<typeof AdminAgentListItemSchema>;
export type AdminAgentListResponse = z.infer<
  typeof AdminAgentListResponseSchema
>;
export type AdminSystemAgentMutationRequest = z.infer<
  typeof AdminSystemAgentMutationRequestSchema
>;
export type AdminSystemAgentUpdateRequest = z.infer<
  typeof AdminSystemAgentUpdateRequestSchema
>;
export type AdminAgentDetailResponse = z.infer<
  typeof AdminAgentDetailResponseSchema
>;
export type AdminSystemAgentMutationResponse = z.infer<
  typeof AdminSystemAgentMutationResponseSchema
>;
export type AdminSystemAgentDeleteResponse = z.infer<
  typeof AdminSystemAgentDeleteResponseSchema
>;
export type AdminMessageFeedbackListQuery = z.infer<
  typeof AdminMessageFeedbackListQuerySchema
>;
export type AdminMessageFeedbackListItem = z.infer<
  typeof AdminMessageFeedbackListItemSchema
>;
export type AdminMessageFeedbackStatus = z.infer<
  typeof AdminMessageFeedbackStatusSchema
>;
export type AdminMessageFeedbackListResponse = z.infer<
  typeof AdminMessageFeedbackListResponseSchema
>;
export type AdminMessageFeedbackDetailResponse = z.infer<
  typeof AdminMessageFeedbackDetailResponseSchema
>;
export type AdminMessageFeedbackUpdateRequest = z.infer<
  typeof AdminMessageFeedbackUpdateRequestSchema
>;
export type AdminMessageFeedbackUpdateResponse = z.infer<
  typeof AdminMessageFeedbackUpdateResponseSchema
>;
