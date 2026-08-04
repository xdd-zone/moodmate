import {
  BizCode,
  type AddAgentGroupChatMembersRequest,
  type AgentGroupChatDetail,
  type AgentGroupChatListItem,
  type AgentGroupChatListResponse,
  type AgentGroupChatMember,
  type AgentGroupChatMessagesResponse,
  type CreateAgentGroupChatRequest,
  type SendAgentGroupChatMessageResponse,
} from "@repo/contracts";
import { uuidv7 } from "uuidv7";

import {
  listActiveAgentMemories,
  listOwnedUserAgentsByIds,
} from "@/modules/agents/agents.repository";
import type {
  AgentMemoryRecord,
  UserAgentRecord,
} from "@/modules/agents/agents.schema";
import { resolveActiveLlmProviderConfig } from "@/modules/llm-config/llm-config.service";
import { AppError } from "@/shared/app-error";
import type { ApiBindings } from "@/shared/hono-env";

import type { ChatProviderConfig } from "@/modules/chat/chat.types";

import {
  presentDetail,
  presentListItem,
  presentMember,
  presentMessage,
} from "./group-chat.presenter";
import {
  addOrReviveMembers,
  getGroupChatById,
  getGroupChatWithMemberCount,
  getMaxDisplayOrder,
  insertGroupChatMessages,
  insertGroupChatWithMembers,
  listActiveMembers,
  listAllMembers,
  listGroupChatMessages,
  listGroupChatsForUser as listGroupChatsForUserRows,
  removeMember,
  updateGroupChatStats,
  type AddOrReviveMemberInput,
  type GroupChatMessageWithAgentRow,
  type NewGroupChatMessage,
} from "./group-chat.repository";
import {
  orchestrateGroupChatReplies,
  type GroupChatAgentSelection,
  type GroupChatCrossReplyPlan,
  type GroupChatIntent,
  type GroupChatReplyQuality,
} from "./group-chat.orchestration";
import type { AgentGroupChatRecord } from "./group-chat.schema";
import type { GroupSpeakingContext } from "./group-chat.speaking";

const MAX_MEMBERS = 6;
const RECENT_MESSAGES_LIMIT = 50;
const MESSAGES_PAGE_LIMIT = 30;
const REPLY_HISTORY_LIMIT = 20;
const AGENT_MEMORY_INJECTION_LIMIT = 6;

function forbidden() {
  return new AppError(BizCode.AUTH_FORBIDDEN, "无权访问该群聊", 403);
}

function memberLimitExceeded() {
  return new AppError(
    BizCode.COMMON_INVALID_REQUEST,
    `群聊成员不能超过 ${MAX_MEMBERS} 个`,
    422,
  );
}

function dedupe(agentIds: string[]): string[] {
  return [...new Set(agentIds)];
}

async function assertOwnedAgents(input: {
  agentIds: string[];
  bindings: ApiBindings;
  userId: string;
}): Promise<void> {
  const owned = await listOwnedUserAgentsByIds({
    agentIds: input.agentIds,
    database: input.bindings.DB,
    userId: input.userId,
  });

  if (owned.length !== input.agentIds.length) {
    throw forbidden();
  }
}

async function requireGroupChat(input: {
  bindings: ApiBindings;
  groupChatId: string;
  userId: string;
}): Promise<AgentGroupChatRecord> {
  const record = await getGroupChatById({
    database: input.bindings.DB,
    groupChatId: input.groupChatId,
    userId: input.userId,
  });

  if (!record) {
    throw forbidden();
  }

  return record;
}

export async function listGroupChatsForUser(input: {
  bindings: ApiBindings;
  userId: string;
}): Promise<AgentGroupChatListResponse> {
  const rows = await listGroupChatsForUserRows({
    database: input.bindings.DB,
    userId: input.userId,
  });

  return { items: rows.map(presentListItem) };
}

export async function createGroupChatForUser(input: {
  bindings: ApiBindings;
  payload: CreateAgentGroupChatRequest;
  userId: string;
}): Promise<{ groupChat: AgentGroupChatListItem }> {
  const agentIds = dedupe(input.payload.agentIds);

  if (agentIds.length === 0 || agentIds.length > MAX_MEMBERS) {
    throw memberLimitExceeded();
  }

  await assertOwnedAgents({
    agentIds,
    bindings: input.bindings,
    userId: input.userId,
  });

  const nowMs = Date.now();
  const record = await insertGroupChatWithMembers({
    database: input.bindings.DB,
    members: agentIds.map((agentId, index) => ({
      agentId,
      displayOrder: index,
    })),
    nowMs,
    title: input.payload.title.trim(),
    userId: input.userId,
  });

  return {
    groupChat: {
      createdAtMs: record.createdAtMs,
      id: record.id,
      lastMessageAtMs: record.lastMessageAtMs,
      memberCount: agentIds.length,
      messageCount: record.messageCount,
      summary: record.summary,
      title: record.title,
      updatedAtMs: record.updatedAtMs,
    },
  };
}

export async function getGroupChatDetail(input: {
  bindings: ApiBindings;
  groupChatId: string;
  userId: string;
}): Promise<AgentGroupChatDetail> {
  const groupChat = await getGroupChatWithMemberCount({
    database: input.bindings.DB,
    groupChatId: input.groupChatId,
    userId: input.userId,
  });

  if (!groupChat) {
    throw forbidden();
  }

  const [members, recentMessages] = await Promise.all([
    listActiveMembers({
      database: input.bindings.DB,
      groupChatId: input.groupChatId,
    }),
    listGroupChatMessages({
      database: input.bindings.DB,
      groupChatId: input.groupChatId,
      limit: RECENT_MESSAGES_LIMIT,
    }),
  ]);

  return presentDetail({ groupChat, members, recentMessages });
}

export async function getGroupChatMessages(input: {
  bindings: ApiBindings;
  cursor?: number;
  groupChatId: string;
  userId: string;
}): Promise<AgentGroupChatMessagesResponse> {
  await requireGroupChat({
    bindings: input.bindings,
    groupChatId: input.groupChatId,
    userId: input.userId,
  });

  const rows = await listGroupChatMessages({
    cursor: input.cursor,
    database: input.bindings.DB,
    groupChatId: input.groupChatId,
    limit: MESSAGES_PAGE_LIMIT,
  });

  const nextCursor =
    rows.length === MESSAGES_PAGE_LIMIT ? (rows[0]?.createdAtMs ?? null) : null;

  return { items: rows.map(presentMessage), nextCursor };
}

export async function addGroupChatMembers(input: {
  bindings: ApiBindings;
  groupChatId: string;
  payload: AddAgentGroupChatMembersRequest;
  userId: string;
}): Promise<AgentGroupChatDetail> {
  await requireGroupChat({
    bindings: input.bindings,
    groupChatId: input.groupChatId,
    userId: input.userId,
  });

  const agentIds = dedupe(input.payload.agentIds);

  if (agentIds.length === 0) {
    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      "请至少选择一个 Agent",
      422,
    );
  }

  await assertOwnedAgents({
    agentIds,
    bindings: input.bindings,
    userId: input.userId,
  });

  const existingMembers = await listAllMembers({
    database: input.bindings.DB,
    groupChatId: input.groupChatId,
  });

  const existingByAgentId = new Map(
    existingMembers.map((member) => [member.agentId, member]),
  );

  const activeCount = existingMembers.filter(
    (member) => member.status === "active",
  ).length;

  const newlyActivated = agentIds.filter((agentId) => {
    const existing = existingByAgentId.get(agentId);

    return !existing || existing.status !== "active";
  });

  if (activeCount + newlyActivated.length > MAX_MEMBERS) {
    throw memberLimitExceeded();
  }

  const maxDisplayOrder = await getMaxDisplayOrder({
    database: input.bindings.DB,
    groupChatId: input.groupChatId,
  });

  let nextOrder = maxDisplayOrder + 1;
  const toWrite: AddOrReviveMemberInput[] = [];

  for (const agentId of agentIds) {
    const existing = existingByAgentId.get(agentId);

    if (existing?.status === "active") {
      continue;
    }

    toWrite.push({
      agentId,
      displayOrder: nextOrder,
      existingMemberId: existing ? existing.id : null,
    });
    nextOrder += 1;
  }

  if (toWrite.length > 0) {
    await addOrReviveMembers({
      database: input.bindings.DB,
      groupChatId: input.groupChatId,
      members: toWrite,
      nowMs: Date.now(),
      userId: input.userId,
    });
  }

  return getGroupChatDetail({
    bindings: input.bindings,
    groupChatId: input.groupChatId,
    userId: input.userId,
  });
}

export async function removeGroupChatMember(input: {
  bindings: ApiBindings;
  groupChatId: string;
  memberId: string;
  userId: string;
}): Promise<{ members: AgentGroupChatMember[]; success: true }> {
  await requireGroupChat({
    bindings: input.bindings,
    groupChatId: input.groupChatId,
    userId: input.userId,
  });

  await removeMember({
    database: input.bindings.DB,
    groupChatId: input.groupChatId,
    memberId: input.memberId,
    nowMs: Date.now(),
  });

  const members = await listActiveMembers({
    database: input.bindings.DB,
    groupChatId: input.groupChatId,
  });

  return { members: members.map(presentMember), success: true };
}

async function resolveGroupChatProviderConfig(
  bindings: ApiBindings,
): Promise<{ llmConfigId: string; providerConfig: ChatProviderConfig }> {
  const active = await resolveActiveLlmProviderConfig(bindings);

  return {
    llmConfigId: active.id,
    providerConfig: {
      api: active.api,
      apiKey: active.apiKey,
      baseURL: active.baseURL.trim().replace(/\/+$/, ""),
      disableThinking:
        active.providerOptions?.[
          active.api === "openai-responses"
            ? "openai-responses"
            : "openai-chat-completions"
        ]?.disableThinking ?? false,
      model: active.model,
      providerName: active.providerName,
    },
  };
}

export async function sendGroupChatMessage(input: {
  bindings: ApiBindings;
  groupChatId: string;
  message: string;
  requestId: string;
  signal: AbortSignal;
  userId: string;
}): Promise<SendAgentGroupChatMessageResponse> {
  const groupChat = await requireGroupChat({
    bindings: input.bindings,
    groupChatId: input.groupChatId,
    userId: input.userId,
  });

  const members = await listActiveMembers({
    database: input.bindings.DB,
    groupChatId: input.groupChatId,
  });

  const agentRecords =
    members.length > 0
      ? await listOwnedUserAgentsByIds({
          agentIds: members.map((member) => member.agentId),
          database: input.bindings.DB,
          userId: input.userId,
        })
      : [];
  const agentRecordsById: Record<string, UserAgentRecord> = {};
  for (const record of agentRecords) {
    agentRecordsById[record.id] = record;
  }
  const respondingMembers = members.filter(
    (member) => agentRecordsById[member.agentId] !== undefined,
  );

  const recent = await listGroupChatMessages({
    database: input.bindings.DB,
    groupChatId: input.groupChatId,
    limit: REPLY_HISTORY_LIMIT,
  });

  const turnIndex = (recent.at(-1)?.turnIndex ?? 0) + 1;
  const userText = input.message.trim();

  let nextCreatedAtMs = Date.now();
  const nextTimestamp = () => {
    const value = nextCreatedAtMs;
    nextCreatedAtMs += 1;
    return value;
  };

  const userRow: GroupChatMessageWithAgentRow = {
    agentId: null,
    agentImageKey: null,
    agentName: null,
    content: userText,
    createdAtMs: nextTimestamp(),
    groupChatId: input.groupChatId,
    id: uuidv7(),
    senderType: "user",
    status: "completed",
    turnIndex,
  };

  const provider =
    respondingMembers.length > 0
      ? await resolveGroupChatProviderConfig(input.bindings)
      : null;

  // agentRows 携带补充回应追踪字段，只用于落库 metadata，不进 presenter 契约。
  type AgentRowWithCrossReply = GroupChatMessageWithAgentRow & {
    replyKind: "primary" | "cross_agent";
    respondToAgentId: string | null;
    crossReplyReason: string | null;
    crossReplyRound: number | null;
  };

  const agentRows: AgentRowWithCrossReply[] = [];
  let orchestration: {
    intent: GroupChatIntent | null;
    selection: GroupChatAgentSelection | null;
    quality: GroupChatReplyQuality | null;
    crossReplyPlan: GroupChatCrossReplyPlan | null;
    speakingContext: GroupSpeakingContext | null;
  } | null = null;
  let selectedBy = "langgraph_v1";

  if (respondingMembers.length > 0 && provider) {
    const agentMemoriesByAgentId: Record<string, AgentMemoryRecord[]> = {};
    for (const member of respondingMembers) {
      agentMemoriesByAgentId[member.agentId] = await listActiveAgentMemories({
        agentId: member.agentId,
        database: input.bindings.DB,
        limit: AGENT_MEMORY_INJECTION_LIMIT,
        userId: input.userId,
      });
    }

    const result = await orchestrateGroupChatReplies({
      providerConfig: provider.providerConfig,
      groupChat,
      agents: respondingMembers,
      recentMessages: [...recent, userRow],
      userMessage: userRow,
      userText,
      agentMemoriesByAgentId,
      agentRecordsById,
      aiUsage: {
        bindings: input.bindings,
        llmConfigId: provider.llmConfigId,
        requestId: input.requestId,
        userId: input.userId,
      },
      signal: input.signal,
    });

    if (result.usedFallback) {
      selectedBy = "v1_rules_fallback";
    }

    orchestration = {
      intent: result.intent,
      selection: result.selection,
      quality: result.quality,
      crossReplyPlan: result.crossReplyPlan,
      speakingContext: result.speakingContext,
    };

    for (const reply of result.replies) {
      agentRows.push({
        agentId: reply.agent.agentId,
        agentImageKey: reply.agent.imageKey,
        agentName: reply.agent.name,
        content: reply.content,
        createdAtMs: nextTimestamp(),
        groupChatId: input.groupChatId,
        id: uuidv7(),
        senderType: "agent",
        status: reply.status,
        turnIndex,
        replyKind: reply.replyKind ?? "primary",
        respondToAgentId: reply.respondToAgentId ?? null,
        crossReplyReason: reply.crossReplyReason ?? null,
        crossReplyRound: reply.crossReplyRound ?? null,
      });
    }
  }

  const messagesToInsert: NewGroupChatMessage[] = [
    {
      agentId: null,
      content: userRow.content,
      createdAtMs: userRow.createdAtMs,
      groupChatId: input.groupChatId,
      id: userRow.id,
      metadataJson: JSON.stringify({ source: "group_chat_user" }),
      senderType: "user",
      status: "completed",
      turnIndex,
    },
    ...agentRows.map((row) => ({
      agentId: row.agentId,
      content: row.content,
      createdAtMs: row.createdAtMs,
      groupChatId: input.groupChatId,
      id: row.id,
      metadataJson: JSON.stringify({
        crossReplyReason: row.crossReplyReason,
        crossReplyRound: row.crossReplyRound,
        model: provider?.providerConfig.model ?? null,
        orchestration,
        providerName: provider?.providerConfig.providerName ?? null,
        replyKind: row.replyKind,
        respondToAgentId: row.respondToAgentId,
        selectedBy,
        source: "group_chat_agent",
      }),
      senderType: "agent" as const,
      status: row.status,
      turnIndex,
    })),
  ];

  await insertGroupChatMessages({
    database: input.bindings.DB,
    messages: messagesToInsert,
  });

  const lastMessageAtMs = messagesToInsert.at(-1)?.createdAtMs ?? Date.now();

  await updateGroupChatStats({
    addedCount: messagesToInsert.length,
    database: input.bindings.DB,
    groupChatId: input.groupChatId,
    lastMessageAtMs,
  });

  const listRow = await getGroupChatWithMemberCount({
    database: input.bindings.DB,
    groupChatId: input.groupChatId,
    userId: input.userId,
  });

  if (!listRow) {
    throw forbidden();
  }

  return {
    agentMessages: agentRows.map(presentMessage),
    groupChat: presentListItem(listRow),
    userMessage: presentMessage(userRow),
  };
}
