import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { createD1Client } from "@/infra/db/d1";
import { userAgents } from "@/modules/agents/agents.schema";

import {
  agentGroupChatMembers,
  agentGroupChatMessages,
  agentGroupChats,
  type AgentGroupChatMemberRecord,
  type AgentGroupChatMessageRecord,
  type AgentGroupChatRecord,
} from "./group-chat.schema";

export interface GroupChatListRow {
  id: string;
  title: string;
  summary: string | null;
  messageCount: number;
  lastMessageAtMs: number | null;
  memberCount: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface GroupChatMemberWithAgentRow {
  id: string;
  agentId: string;
  name: string;
  headline: string | null;
  imageKey: string | null;
  status: "active" | "removed";
  displayOrder: number;
  joinedAtMs: number;
}

export interface GroupChatMessageWithAgentRow {
  id: string;
  groupChatId: string;
  senderType: "user" | "agent" | "system";
  agentId: string | null;
  agentName: string | null;
  agentImageKey: string | null;
  content: string;
  status: "completed" | "failed";
  turnIndex: number;
  createdAtMs: number;
}

export interface CreateGroupChatMemberInput {
  agentId: string;
  displayOrder: number;
}

export async function insertGroupChatWithMembers(input: {
  database: D1Database | undefined;
  members: CreateGroupChatMemberInput[];
  nowMs: number;
  title: string;
  userId: string;
}): Promise<AgentGroupChatRecord> {
  const db = createD1Client(input.database);
  const groupChatId = uuidv7();

  const groupChatValues = {
    createdAtMs: input.nowMs,
    id: groupChatId,
    lastMessageAtMs: null,
    messageCount: 0,
    summary: null,
    title: input.title,
    updatedAtMs: input.nowMs,
    userId: input.userId,
  };

  const memberInserts = input.members.map((member) =>
    db.insert(agentGroupChatMembers).values({
      agentId: member.agentId,
      displayOrder: member.displayOrder,
      groupChatId,
      id: uuidv7(),
      joinedAtMs: input.nowMs,
      removedAtMs: null,
      status: "active",
      userId: input.userId,
    }),
  );

  await db.batch([
    db.insert(agentGroupChats).values(groupChatValues),
    ...(memberInserts as [(typeof memberInserts)[number]]),
  ]);

  return { ...groupChatValues };
}

export async function listGroupChatsForUser(input: {
  database: D1Database | undefined;
  userId: string;
}): Promise<GroupChatListRow[]> {
  const db = createD1Client(input.database);

  const memberCountExpr = sql<number>`(
    SELECT COUNT(*) FROM ${agentGroupChatMembers}
    WHERE ${agentGroupChatMembers.groupChatId} = ${agentGroupChats.id}
      AND ${agentGroupChatMembers.status} = 'active'
  )`;

  const rows = await db
    .select({
      createdAtMs: agentGroupChats.createdAtMs,
      id: agentGroupChats.id,
      lastMessageAtMs: agentGroupChats.lastMessageAtMs,
      memberCount: memberCountExpr,
      messageCount: agentGroupChats.messageCount,
      summary: agentGroupChats.summary,
      title: agentGroupChats.title,
      updatedAtMs: agentGroupChats.updatedAtMs,
    })
    .from(agentGroupChats)
    .where(eq(agentGroupChats.userId, input.userId))
    .orderBy(desc(agentGroupChats.updatedAtMs), desc(agentGroupChats.id));

  return rows.map((row) => ({
    ...row,
    memberCount: Number(row.memberCount ?? 0),
  }));
}

export async function getGroupChatById(input: {
  database: D1Database | undefined;
  groupChatId: string;
  userId: string;
}): Promise<AgentGroupChatRecord | null> {
  const db = createD1Client(input.database);

  const rows = await db
    .select()
    .from(agentGroupChats)
    .where(
      and(
        eq(agentGroupChats.id, input.groupChatId),
        eq(agentGroupChats.userId, input.userId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function getGroupChatWithMemberCount(input: {
  database: D1Database | undefined;
  groupChatId: string;
  userId: string;
}): Promise<GroupChatListRow | null> {
  const db = createD1Client(input.database);

  const memberCountExpr = sql<number>`(
    SELECT COUNT(*) FROM ${agentGroupChatMembers}
    WHERE ${agentGroupChatMembers.groupChatId} = ${agentGroupChats.id}
      AND ${agentGroupChatMembers.status} = 'active'
  )`;

  const rows = await db
    .select({
      createdAtMs: agentGroupChats.createdAtMs,
      id: agentGroupChats.id,
      lastMessageAtMs: agentGroupChats.lastMessageAtMs,
      memberCount: memberCountExpr,
      messageCount: agentGroupChats.messageCount,
      summary: agentGroupChats.summary,
      title: agentGroupChats.title,
      updatedAtMs: agentGroupChats.updatedAtMs,
    })
    .from(agentGroupChats)
    .where(
      and(
        eq(agentGroupChats.id, input.groupChatId),
        eq(agentGroupChats.userId, input.userId),
      ),
    )
    .limit(1);

  const row = rows[0];

  if (!row) {
    return null;
  }

  return { ...row, memberCount: Number(row.memberCount ?? 0) };
}

export async function listActiveMembers(input: {
  database: D1Database | undefined;
  groupChatId: string;
}): Promise<GroupChatMemberWithAgentRow[]> {
  const db = createD1Client(input.database);

  return db
    .select({
      agentId: agentGroupChatMembers.agentId,
      displayOrder: agentGroupChatMembers.displayOrder,
      headline: userAgents.headline,
      id: agentGroupChatMembers.id,
      imageKey: userAgents.imageKey,
      joinedAtMs: agentGroupChatMembers.joinedAtMs,
      name: userAgents.name,
      status: agentGroupChatMembers.status,
    })
    .from(agentGroupChatMembers)
    .innerJoin(userAgents, eq(userAgents.id, agentGroupChatMembers.agentId))
    .where(
      and(
        eq(agentGroupChatMembers.groupChatId, input.groupChatId),
        eq(agentGroupChatMembers.status, "active"),
      ),
    )
    .orderBy(agentGroupChatMembers.displayOrder);
}

export async function listGroupChatMessages(input: {
  cursor?: number;
  database: D1Database | undefined;
  groupChatId: string;
  limit: number;
}): Promise<GroupChatMessageWithAgentRow[]> {
  const db = createD1Client(input.database);
  const conditions: SQL[] = [
    eq(agentGroupChatMessages.groupChatId, input.groupChatId),
  ];

  if (input.cursor !== undefined) {
    conditions.push(
      sql`${agentGroupChatMessages.createdAtMs} < ${input.cursor}`,
    );
  }

  const rows = await db
    .select({
      agentId: agentGroupChatMessages.agentId,
      agentImageKey: userAgents.imageKey,
      agentName: userAgents.name,
      content: agentGroupChatMessages.content,
      createdAtMs: agentGroupChatMessages.createdAtMs,
      groupChatId: agentGroupChatMessages.groupChatId,
      id: agentGroupChatMessages.id,
      senderType: agentGroupChatMessages.senderType,
      status: agentGroupChatMessages.status,
      turnIndex: agentGroupChatMessages.turnIndex,
    })
    .from(agentGroupChatMessages)
    .leftJoin(userAgents, eq(userAgents.id, agentGroupChatMessages.agentId))
    .where(and(...conditions))
    .orderBy(
      desc(agentGroupChatMessages.createdAtMs),
      desc(agentGroupChatMessages.id),
    )
    .limit(input.limit);

  return rows.reverse();
}

export async function countActiveMembers(input: {
  database: D1Database | undefined;
  groupChatId: string;
}): Promise<number> {
  const db = createD1Client(input.database);

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentGroupChatMembers)
    .where(
      and(
        eq(agentGroupChatMembers.groupChatId, input.groupChatId),
        eq(agentGroupChatMembers.status, "active"),
      ),
    );

  return Number(rows[0]?.count ?? 0);
}

export async function listAllMembers(input: {
  database: D1Database | undefined;
  groupChatId: string;
}): Promise<AgentGroupChatMemberRecord[]> {
  const db = createD1Client(input.database);

  return db
    .select()
    .from(agentGroupChatMembers)
    .where(eq(agentGroupChatMembers.groupChatId, input.groupChatId));
}

export async function getMaxDisplayOrder(input: {
  database: D1Database | undefined;
  groupChatId: string;
}): Promise<number> {
  const db = createD1Client(input.database);

  const rows = await db
    .select({ max: sql<number>`MAX(${agentGroupChatMembers.displayOrder})` })
    .from(agentGroupChatMembers)
    .where(eq(agentGroupChatMembers.groupChatId, input.groupChatId));

  return Number(rows[0]?.max ?? -1);
}

export interface AddOrReviveMemberInput {
  agentId: string;
  displayOrder: number;
  existingMemberId: string | null;
}

export async function addOrReviveMembers(input: {
  database: D1Database | undefined;
  members: AddOrReviveMemberInput[];
  nowMs: number;
  groupChatId: string;
  userId: string;
}): Promise<void> {
  const db = createD1Client(input.database);

  const statements = input.members.map((member) => {
    if (member.existingMemberId) {
      return db
        .update(agentGroupChatMembers)
        .set({
          displayOrder: member.displayOrder,
          joinedAtMs: input.nowMs,
          removedAtMs: null,
          status: "active",
        })
        .where(eq(agentGroupChatMembers.id, member.existingMemberId));
    }

    return db.insert(agentGroupChatMembers).values({
      agentId: member.agentId,
      displayOrder: member.displayOrder,
      groupChatId: input.groupChatId,
      id: uuidv7(),
      joinedAtMs: input.nowMs,
      removedAtMs: null,
      status: "active",
      userId: input.userId,
    });
  });

  if (statements.length === 0) {
    return;
  }

  await db.batch([statements[0]!, ...statements.slice(1)]);
}

export async function removeMember(input: {
  database: D1Database | undefined;
  groupChatId: string;
  memberId: string;
  nowMs: number;
}): Promise<AgentGroupChatMemberRecord | null> {
  const db = createD1Client(input.database);

  const rows = await db
    .update(agentGroupChatMembers)
    .set({ removedAtMs: input.nowMs, status: "removed" })
    .where(
      and(
        eq(agentGroupChatMembers.id, input.memberId),
        eq(agentGroupChatMembers.groupChatId, input.groupChatId),
        eq(agentGroupChatMembers.status, "active"),
      ),
    )
    .returning();

  return rows[0] ?? null;
}

export type {
  AgentGroupChatMemberRecord,
  AgentGroupChatMessageRecord,
  AgentGroupChatRecord,
};
