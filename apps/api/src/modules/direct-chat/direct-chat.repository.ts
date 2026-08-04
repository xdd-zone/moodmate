import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { createD1Client } from "@/infra/db/d1";
import {
  agents,
  agentConversationMessages,
  agentConversations,
  agentMessageFeedbacks,
} from "@/modules/agents/agents.schema";

export async function listDirectChats(input: {
  database: D1Database | undefined;
  userId: string;
}) {
  const db = createD1Client(input.database);
  return db
    .select({
      agent: agents,
      conversation: agentConversations,
    })
    .from(agentConversations)
    .innerJoin(agents, eq(agents.id, agentConversations.agentId))
    .where(eq(agentConversations.userId, input.userId))
    .orderBy(desc(agentConversations.updatedAtMs), desc(agentConversations.id));
}

export async function findAccessibleAgent(input: {
  agentId: string;
  database: D1Database | undefined;
  userId: string;
}) {
  const db = createD1Client(input.database);
  const rows = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.id, input.agentId),
        eq(agents.status, "active"),
        or(
          eq(agents.source, "system"),
          and(eq(agents.source, "user"), eq(agents.ownerUserId, input.userId)),
        ),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function findDirectChat(input: {
  conversationId: string;
  database: D1Database | undefined;
  userId: string;
}) {
  const db = createD1Client(input.database);
  const rows = await db
    .select({ agent: agents, conversation: agentConversations })
    .from(agentConversations)
    .innerJoin(agents, eq(agents.id, agentConversations.agentId))
    .where(
      and(
        eq(agentConversations.id, input.conversationId),
        eq(agentConversations.userId, input.userId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getOrCreateDirectChat(input: {
  agentId: string;
  database: D1Database | undefined;
  userId: string;
  nowMs: number;
}) {
  const db = createD1Client(input.database);
  const existing = await db
    .select()
    .from(agentConversations)
    .where(
      and(
        eq(agentConversations.agentId, input.agentId),
        eq(agentConversations.userId, input.userId),
      ),
    )
    .limit(1);
  if (existing[0]) return { conversation: existing[0], created: false };
  const conversation = {
    id: uuidv7(),
    userId: input.userId,
    agentId: input.agentId,
    title: null,
    summary: null,
    messageCount: 0,
    lastMessageAtMs: null,
    createdAtMs: input.nowMs,
    updatedAtMs: input.nowMs,
  };
  try {
    await db.insert(agentConversations).values(conversation);
    return { conversation, created: true };
  } catch (error) {
    const raced = await db
      .select()
      .from(agentConversations)
      .where(
        and(
          eq(agentConversations.agentId, input.agentId),
          eq(agentConversations.userId, input.userId),
        ),
      )
      .limit(1);
    if (raced[0]) return { conversation: raced[0], created: false };
    throw error;
  }
}

export async function listDirectMessages(input: {
  conversationId: string;
  cursor?: number;
  database: D1Database | undefined;
  limit: number;
}) {
  const db = createD1Client(input.database);
  const rows = await db
    .select()
    .from(agentConversationMessages)
    .where(
      and(
        eq(agentConversationMessages.conversationId, input.conversationId),
        input.cursor === undefined
          ? undefined
          : lt(agentConversationMessages.createdAtMs, input.cursor),
      ),
    )
    .orderBy(
      desc(agentConversationMessages.createdAtMs),
      desc(agentConversationMessages.id),
    )
    .limit(input.limit);
  return rows.reverse();
}

export async function listDirectMessagesWithFeedback(input: {
  conversationId: string;
  cursor?: number;
  database: D1Database | undefined;
  limit: number;
  userId: string;
}) {
  const db = createD1Client(input.database);
  const rows = await db
    .select({
      feedback: agentMessageFeedbacks,
      message: agentConversationMessages,
    })
    .from(agentConversationMessages)
    .leftJoin(
      agentMessageFeedbacks,
      and(
        eq(agentMessageFeedbacks.messageId, agentConversationMessages.id),
        eq(agentMessageFeedbacks.userId, input.userId),
      ),
    )
    .where(
      and(
        eq(agentConversationMessages.conversationId, input.conversationId),
        input.cursor === undefined
          ? undefined
          : lt(agentConversationMessages.createdAtMs, input.cursor),
      ),
    )
    .orderBy(
      desc(agentConversationMessages.createdAtMs),
      desc(agentConversationMessages.id),
    )
    .limit(input.limit);

  return rows.reverse();
}

export async function insertDirectMessage(input: {
  conversationId: string;
  content: string;
  database: D1Database | undefined;
  role: "user" | "assistant";
  status: "completed" | "failed";
  turnId: string;
  nowMs: number;
}) {
  const db = createD1Client(input.database);
  const message = {
    id: uuidv7(),
    conversationId: input.conversationId,
    turnId: input.turnId,
    role: input.role,
    content: input.content,
    status: input.status,
    metadataJson: null,
    createdAtMs: input.nowMs,
  };
  await db.batch([
    db.insert(agentConversationMessages).values(message),
    db
      .update(agentConversations)
      .set({
        messageCount: sql`${agentConversations.messageCount} + 1`,
        lastMessageAtMs: input.nowMs,
        updatedAtMs: input.nowMs,
      })
      .where(eq(agentConversations.id, input.conversationId)),
  ]);
  return message;
}

export async function findFeedback(input: {
  database: D1Database | undefined;
  messageId: string;
  userId: string;
}) {
  const db = createD1Client(input.database);
  const rows = await db
    .select()
    .from(agentMessageFeedbacks)
    .where(
      and(
        eq(agentMessageFeedbacks.messageId, input.messageId),
        eq(agentMessageFeedbacks.userId, input.userId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function findAssistantMessage(input: {
  conversationId: string;
  database: D1Database | undefined;
  messageId: string;
}) {
  const db = createD1Client(input.database);
  const rows = await db
    .select()
    .from(agentConversationMessages)
    .where(
      and(
        eq(agentConversationMessages.id, input.messageId),
        eq(agentConversationMessages.conversationId, input.conversationId),
        eq(agentConversationMessages.role, "assistant"),
        eq(agentConversationMessages.status, "completed"),
        sql`exists (
          select 1
          from agent_conversation_messages as paired_user
          where paired_user.conversation_id = ${agentConversationMessages.conversationId}
            and paired_user.turn_id = ${agentConversationMessages.turnId}
            and paired_user.role = 'user'
        )`,
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertFeedback(input: {
  conversationId: string;
  database: D1Database | undefined;
  messageId: string;
  note: string | null;
  rating: "positive" | "negative";
  reason: string | null;
  turnId: string;
  userId: string;
  nowMs: number;
}) {
  const db = createD1Client(input.database);
  const existing = await findFeedback({
    database: input.database,
    messageId: input.messageId,
    userId: input.userId,
  });
  if (existing) {
    const rows = await db
      .update(agentMessageFeedbacks)
      .set({
        note: input.note,
        rating: input.rating,
        reason: input.reason,
        updatedAtMs: input.nowMs,
      })
      .where(eq(agentMessageFeedbacks.id, existing.id))
      .returning();
    return rows[0]!;
  }
  const feedback = {
    id: uuidv7(),
    userId: input.userId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    turnId: input.turnId,
    rating: input.rating,
    reason: input.reason,
    note: input.note,
    createdAtMs: input.nowMs,
    updatedAtMs: input.nowMs,
  };
  await db.insert(agentMessageFeedbacks).values(feedback);
  return feedback;
}
