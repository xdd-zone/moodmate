import {
  BizCode,
  type AddAgentGroupChatMembersRequest,
  type AgentGroupChatDetail,
  type AgentGroupChatListItem,
  type AgentGroupChatListResponse,
  type AgentGroupChatMember,
  type AgentGroupChatMessagesResponse,
  type CreateAgentGroupChatRequest,
} from "@repo/contracts";

import { listOwnedUserAgentsByIds } from "@/modules/agents/agents.repository";
import { AppError } from "@/shared/app-error";
import type { ApiBindings } from "@/shared/hono-env";

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
  insertGroupChatWithMembers,
  listActiveMembers,
  listAllMembers,
  listGroupChatMessages,
  listGroupChatsForUser as listGroupChatsForUserRows,
  removeMember,
  type AddOrReviveMemberInput,
} from "./group-chat.repository";

const MAX_MEMBERS = 6;
const RECENT_MESSAGES_LIMIT = 50;
const MESSAGES_PAGE_LIMIT = 30;

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
}): Promise<void> {
  const record = await getGroupChatById({
    database: input.bindings.DB,
    groupChatId: input.groupChatId,
    userId: input.userId,
  });

  if (!record) {
    throw forbidden();
  }
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
