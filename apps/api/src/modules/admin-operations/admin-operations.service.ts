import {
  BizCode,
  type AdminAiCallListQuery,
  type AdminAgentListQuery,
  type AdminMessageFeedbackListQuery,
  type AdminMessageFeedbackUpdateRequest,
  type AdminSystemAgentMutationRequest,
  type AdminSystemAgentUpdateRequest,
} from "@repo/contracts";
import { uuidv7 } from "uuidv7";
import { AppError } from "@/shared/app-error";
import type { ApiBindings } from "@/shared/hono-env";
import * as repository from "./admin-operations.repository";

function assertAdmin(roles: readonly string[]) {
  if (!roles.includes("admin_owner"))
    throw new AppError(BizCode.AUTH_FORBIDDEN, "没有运营数据查看权限", 403);
}
function dayRange(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
  }).format(now);
  const start = Date.parse(`${today}T00:00:00+08:00`);
  return { startAtMs: start, endAtMs: start + 86_400_000 };
}
const DAY_MS = 86_400_000;

function toNullableTime(value: string | number | null): number | null {
  const time = Number(value ?? 0);
  return time > 0 ? time : null;
}

function presentFeedback(row: Record<string, string | number | null>) {
  return {
    id: String(row.id),
    submittedAtMs: Number(row.submitted_at_ms),
    userId: String(row.user_id),
    userDisplayName: String(row.user_display_name),
    agentId: String(row.agent_id),
    agentName: String(row.agent_name),
    rating: row.rating,
    reason: row.reason,
    note: row.note,
    status: row.status,
    processedAtMs: toNullableTime(row.processed_at_ms),
    processedByDisplayName: row.processed_by_display_name,
  };
}
export async function getAdminOverview(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
}) {
  assertAdmin(input.adminRoles);
  const interval = dayRange();
  const row = await repository.getOverview(
    input.bindings.DB,
    interval.startAtMs,
    interval.endAtMs,
  );
  const trendStartAtMs = interval.startAtMs - 6 * DAY_MS;
  const details = await repository.getOverviewDetails(
    input.bindings.DB,
    trendStartAtMs,
    interval.endAtMs,
  );
  const messageByDay = new Map(
    details.messageTrend.map((item) => [
      String(item.day),
      Number(item.message_count ?? 0),
    ]),
  );
  const aiByDay = new Map(
    details.aiTrend.map((item) => [String(item.day), item]),
  );
  const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
  });
  return {
    generatedAtMs: Date.now(),
    interval: { ...interval, timeZone: "Asia/Shanghai" as const },
    users: {
      total: Number(row.user_total ?? 0),
      createdToday: Number(row.created_today ?? 0),
      activeToday: Number(row.active_today ?? 0),
    },
    agents: {
      system: Number(row.system_agents ?? 0),
      user: Number(row.user_agents ?? 0),
    },
    conversations: {
      direct: Number(row.direct_chats ?? 0),
      group: Number(row.group_chats ?? 0),
    },
    messages: {
      total: Number(row.message_total ?? 0),
      today: Number(row.message_today ?? 0),
    },
    aiCalls: {
      total: Number(row.ai_calls_total ?? 0),
      today: Number(row.ai_calls_today ?? 0),
      failedToday: Number(row.failed_today ?? 0),
      failureRateToday:
        Number(row.terminal_today ?? 0) === 0
          ? 0
          : Number(row.failed_today ?? 0) / Number(row.terminal_today),
    },
    tokens: {
      total: Number(row.tokens_total ?? 0),
      today: Number(row.tokens_today ?? 0),
    },
    trendPeriodDays: 7 as const,
    trend: Array.from({ length: 7 }, (_, index) => {
      const startAtMs = trendStartAtMs + index * DAY_MS;
      const date = dayFormatter.format(new Date(startAtMs));
      const ai = aiByDay.get(date);
      return {
        date,
        startAtMs,
        messageCount: messageByDay.get(date) ?? 0,
        aiCallCount: Number(ai?.ai_call_count ?? 0),
        totalTokens: Number(ai?.total_tokens ?? 0),
      };
    }),
    topUsers: details.topUsers.map((item) => ({
      userId: String(item.user_id),
      displayName: String(item.display_name),
      email: String(item.email),
      totalTokens: Number(item.total_tokens ?? 0),
      callCount: Number(item.call_count ?? 0),
    })),
    topAgents: details.topAgents.map((item) => ({
      agentId: String(item.agent_id),
      name: String(item.name),
      source: item.source,
      totalTokens: Number(item.total_tokens ?? 0),
      callCount: Number(item.call_count ?? 0),
    })),
    recentFailures: details.recentFailures.map((item) => ({
      id: String(item.id),
      startedAtMs: Number(item.started_at_ms),
      scenario: item.scenario,
      providerName: String(item.provider_name),
      model: String(item.model),
      errorCode: item.error_code,
      errorMessage: item.error_message,
      requestId: String(item.request_id),
    })),
  };
}

export async function getAdminUserDetail(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  userId: string;
}) {
  assertAdmin(input.adminRoles);
  const result = await repository.getUserDetail(
    input.bindings.DB,
    input.userId,
  );
  if (!result) {
    throw new AppError(BizCode.COMMON_NOT_FOUND, "用户不存在", 404);
  }
  const user = result.user;
  return {
    user: {
      id: String(user.id),
      displayName: String(user.display_name),
      email: String(user.email),
      status: user.status,
      roles: result.roles.map((role) => ({
        id: String(role.id),
        name: String(role.name),
        code: String(role.code),
        applicationCode: String(role.application_code),
      })),
      createdAtMs: Number(user.created_at_ms),
      lastLoginAtMs: toNullableTime(user.last_login_at_ms),
      lastActiveAtMs: toNullableTime(user.last_active_at_ms),
    },
    summary: {
      friendCount: Number(user.friend_count ?? 0),
      directConversationCount: Number(user.direct_conversation_count ?? 0),
      directMessageCount: Number(user.direct_message_count ?? 0),
      groupConversationCount: Number(user.group_conversation_count ?? 0),
      groupMessageCount: Number(user.group_message_count ?? 0),
      aiCallCount: Number(user.ai_call_count ?? 0),
      failedAiCallCount: Number(user.failed_ai_call_count ?? 0),
      totalTokens: Number(user.total_tokens ?? 0),
    },
    friends: result.friends.map((friend) => ({
      id: String(friend.id),
      name: String(friend.name),
      source: friend.source,
      status: friend.status,
      conversationId: friend.conversation_id,
      messageCount: Number(friend.message_count ?? 0),
      lastActiveAtMs: toNullableTime(friend.last_active_at_ms),
    })),
    groupChats: result.groupChats.map((group) => ({
      id: String(group.id),
      title: String(group.title),
      messageCount: Number(group.message_count ?? 0),
      lastActiveAtMs: toNullableTime(group.last_active_at_ms),
    })),
  };
}
export async function getAdminUserUsage(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  userId: string;
}) {
  assertAdmin(input.adminRoles);
  const interval = dayRange();
  const result = await repository.getUserUsage(
    input.bindings.DB,
    input.userId,
    interval.startAtMs,
    interval.endAtMs,
  );
  const toUsage = (row: Record<string, string | number | null>) => ({
    promptTokens: Number(row.prompt_tokens ?? 0),
    completionTokens: Number(row.completion_tokens ?? 0),
    totalTokens: Number(row.total_tokens ?? 0),
    callCount: Number(row.call_count ?? 0),
  });
  const subjects = result.subjects.map((row) => ({
    subjectType: row.subject_type as "agent" | "system",
    agentId: (row.agent_id as string | null) ?? null,
    agentName: (row.agent_name as string | null) ?? null,
    agentSource: (row.agent_source as "system" | "user" | null) ?? null,
    total: toUsage(row),
    today: {
      promptTokens: Number(row.today_prompt_tokens ?? 0),
      completionTokens: Number(row.today_completion_tokens ?? 0),
      totalTokens: Number(row.today_total_tokens ?? 0),
      callCount: Number(row.today_call_count ?? 0),
    },
    lastCalledAtMs: row.last_called_at_ms
      ? Number(row.last_called_at_ms)
      : null,
  }));
  return {
    userId: input.userId,
    interval: { ...interval, timeZone: "Asia/Shanghai" as const },
    total: toUsage(result.total),
    today: toUsage(result.today),
    failedCallCount: Number(result.total.failed_call_count ?? 0),
    lastCalledAtMs: result.total.last_called_at_ms
      ? Number(result.total.last_called_at_ms)
      : null,
    subjects,
  };
}
export async function getAdminUserCalls(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  userId: string;
  query: AdminAiCallListQuery;
}) {
  assertAdmin(input.adminRoles);
  const result = await repository.listAiCalls(input.bindings.DB, {
    ...input.query,
    userId: input.userId,
    limit: input.query.pageSize,
    offset: (input.query.page - 1) * input.query.pageSize,
  });
  return {
    items: result.items.map((row) => ({
      id: String(row.id),
      requestId: String(row.request_id),
      startedAtMs: Number(row.started_at_ms),
      scenario: row.scenario,
      subjectType: row.subject_type,
      agentId: row.agent_id,
      agentName: row.agent_name_snapshot,
      conversationType: row.conversation_type,
      conversationId: row.conversation_id,
      api: row.api,
      providerName: row.provider_name,
      model: row.model,
      promptTokens:
        row.prompt_tokens === null ? null : Number(row.prompt_tokens),
      completionTokens:
        row.completion_tokens === null ? null : Number(row.completion_tokens),
      totalTokens: row.total_tokens === null ? null : Number(row.total_tokens),
      usageStatus: row.usage_status,
      durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
      status: row.status,
      errorCode: row.error_code,
      errorMessage: row.error_message,
    })),
    page: input.query.page,
    pageSize: input.query.pageSize,
    total: result.total,
    totalPages:
      result.total === 0 ? 0 : Math.ceil(result.total / input.query.pageSize),
  };
}
export async function getAdminAgents(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  query: AdminAgentListQuery;
}) {
  assertAdmin(input.adminRoles);
  const result = await repository.listAgents(input.bindings.DB, {
    ...input.query,
    limit: input.query.pageSize,
    offset: (input.query.page - 1) * input.query.pageSize,
  });
  return {
    items: result.items.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      source: row.source,
      ownerUserId: row.owner_user_id,
      ownerDisplayName: row.owner_display_name,
      ownerEmail: row.owner_email,
      status: row.status,
      userCount: Number(row.user_count ?? 0),
      conversationCount: Number(row.conversation_count ?? 0),
      messageCount: Number(row.message_count ?? 0),
      memoryCount: Number(row.memory_count ?? 0),
      groupCount: Number(row.group_count ?? 0),
      lastUsedAtMs: row.last_used_at_ms ? Number(row.last_used_at_ms) : null,
      createdAtMs: Number(row.created_at_ms),
      updatedAtMs: Number(row.updated_at_ms),
    })),
    page: input.query.page,
    pageSize: input.query.pageSize,
    total: result.total,
    totalPages:
      result.total === 0 ? 0 : Math.ceil(result.total / input.query.pageSize),
  };
}
function presentAgent(row: Record<string, string | number | null>) {
  return {
    id: String(row.id),
    source: row.source,
    ownerUserId: row.owner_user_id,
    name: String(row.name),
    headline: row.headline,
    description: row.description,
    storyBackground: row.story_background,
    personaPrompt: row.persona_prompt,
    tonePrompt: row.tone_prompt,
    guardrailsPrompt: row.guardrails_prompt,
    defaultPrompt: row.default_prompt,
    imageKey: row.image_key,
    status: row.status,
    createdAtMs: Number(row.created_at_ms),
    updatedAtMs: Number(row.updated_at_ms),
  };
}
async function requireSystemAgent(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  agentId: string;
}) {
  const detail = await getAdminAgentDetail(input);
  if (detail.agent.source !== "system") {
    throw new AppError(BizCode.AGENT_NOT_FOUND, "系统朋友不存在", 404);
  }
  return detail;
}
export async function getAdminAgentDetail(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  agentId: string;
}) {
  assertAdmin(input.adminRoles);
  const row = await repository.getAgentDetail(input.bindings.DB, input.agentId);
  if (!row) throw new AppError(BizCode.AGENT_NOT_FOUND, "朋友不存在", 404);
  return {
    agent: presentAgent(row),
    stats: {
      userCount: Number(row.user_count ?? 0),
      conversationCount: Number(row.conversation_count ?? 0),
      messageCount: Number(row.message_count ?? 0),
      memoryCount: Number(row.memory_count ?? 0),
      groupCount: Number(row.group_count ?? 0),
      aiCallCount: Number(row.ai_call_count ?? 0),
      lastUsedAtMs: row.last_used_at_ms ? Number(row.last_used_at_ms) : null,
    },
  };
}
export async function createAdminSystemAgent(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  payload: AdminSystemAgentMutationRequest;
}) {
  assertAdmin(input.adminRoles);
  const id = uuidv7();
  await repository.insertSystemAgent(input.bindings.DB, {
    id,
    ...input.payload,
    headline: input.payload.headline ?? null,
    description: input.payload.description ?? null,
    storyBackground: input.payload.storyBackground ?? null,
    personaPrompt: input.payload.personaPrompt ?? null,
    tonePrompt: input.payload.tonePrompt ?? null,
    guardrailsPrompt: input.payload.guardrailsPrompt ?? null,
    defaultPrompt: input.payload.defaultPrompt ?? null,
    imageKey: input.payload.imageKey ?? null,
    nowMs: Date.now(),
  });
  return getAdminAgentDetail({ ...input, agentId: id });
}
export async function updateAdminSystemAgent(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  agentId: string;
  payload: AdminSystemAgentUpdateRequest;
}) {
  assertAdmin(input.adminRoles);
  await requireSystemAgent(input);
  await repository.updateSystemAgent(
    input.bindings.DB,
    input.agentId,
    input.payload,
  );
  return getAdminAgentDetail(input);
}
export async function setAdminSystemAgentStatus(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  agentId: string;
  status: "active" | "disabled";
}) {
  assertAdmin(input.adminRoles);
  const changed = await repository.setSystemAgentStatus(
    input.bindings.DB,
    input.agentId,
    input.status,
  );
  if (!changed)
    throw new AppError(BizCode.AGENT_NOT_FOUND, "系统朋友不存在", 404);
  return getAdminAgentDetail(input);
}
export async function deleteAdminSystemAgent(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  agentId: string;
}) {
  assertAdmin(input.adminRoles);
  await requireSystemAgent(input);
  const result = await repository.deleteUnusedSystemAgent(
    input.bindings.DB,
    input.agentId,
  );
  if (result === "used")
    throw new AppError(
      BizCode.AGENT_UNAVAILABLE,
      "已被使用的系统朋友只能停用",
      409,
    );
  if (result === "missing")
    throw new AppError(BizCode.AGENT_NOT_FOUND, "系统朋友不存在", 404);
  return { success: true as const };
}
export async function getAdminFeedbacks(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  query: AdminMessageFeedbackListQuery;
}) {
  assertAdmin(input.adminRoles);
  const result = await repository.listFeedbacks(input.bindings.DB, {
    ...input.query,
    limit: input.query.pageSize,
    offset: (input.query.page - 1) * input.query.pageSize,
  });
  return {
    items: result.items.map(presentFeedback),
    page: input.query.page,
    pageSize: input.query.pageSize,
    total: result.total,
    totalPages:
      result.total === 0 ? 0 : Math.ceil(result.total / input.query.pageSize),
  };
}
export async function getAdminFeedbackDetail(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  feedbackId: string;
  adminUserId: string;
  requestId: string;
}) {
  assertAdmin(input.adminRoles);
  const row = await repository.getFeedbackDetail(
    input.bindings.DB,
    input.feedbackId,
  );
  if (!row) throw new AppError(BizCode.COMMON_NOT_FOUND, "反馈不存在", 404);
  await repository.writeFeedbackAudit(input.bindings.DB, {
    adminUserId: input.adminUserId,
    feedbackId: input.feedbackId,
    requestId: input.requestId,
  });
  return {
    feedback: {
      ...presentFeedback(row),
    },
    userMessage: {
      id: String(row.user_message_id),
      content: String(row.user_content),
      createdAtMs: Number(row.user_created_at_ms),
    },
    assistantMessage: {
      id: String(row.assistant_id),
      content: String(row.assistant_content),
      createdAtMs: Number(row.assistant_created_at_ms),
    },
  };
}

export async function updateAdminFeedbackStatus(input: {
  adminRoles: readonly string[];
  adminUserId: string;
  bindings: ApiBindings;
  feedbackId: string;
  payload: AdminMessageFeedbackUpdateRequest;
}) {
  assertAdmin(input.adminRoles);
  const changed = await repository.updateFeedbackStatus(input.bindings.DB, {
    adminUserId: input.adminUserId,
    feedbackId: input.feedbackId,
    status: input.payload.status,
  });
  if (!changed) {
    throw new AppError(BizCode.COMMON_NOT_FOUND, "反馈不存在", 404);
  }
  const row = await repository.getFeedbackDetail(
    input.bindings.DB,
    input.feedbackId,
  );
  if (!row) {
    throw new AppError(BizCode.COMMON_NOT_FOUND, "反馈不存在", 404);
  }
  return { feedback: presentFeedback(row) };
}
