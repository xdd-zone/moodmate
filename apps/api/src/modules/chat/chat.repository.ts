import { and, desc, eq, ne, sql, type SQL } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { createD1Client } from "@/infra/db/d1";

import {
  companionConversationMessages,
  companionConversations,
  companionMemories,
  companionMessageFeedbacks,
  companionProfiles,
  type CompanionConversationMessageRecord,
} from "./chat.schema";

export async function getCompanionProfile(input: {
  database: D1Database | undefined;
  userId: string;
}) {
  const db = createD1Client(input.database);

  const rows = await db
    .select()
    .from(companionProfiles)
    .where(eq(companionProfiles.userId, input.userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getOrCreateCompanionConversation(input: {
  database: D1Database | undefined;
  nowMs: number;
  userId: string;
}) {
  const db = createD1Client(input.database);

  await db
    .insert(companionConversations)
    .values({
      createdAtMs: input.nowMs,
      id: uuidv7(),
      title: "MoodMate",
      updatedAtMs: input.nowMs,
      userId: input.userId,
    })
    .onConflictDoNothing();

  const rows = await db
    .select()
    .from(companionConversations)
    .where(eq(companionConversations.userId, input.userId))
    .limit(1);

  return rows[0] ?? null;
}

export interface CompanionConversationMessageWithFeedback extends CompanionConversationMessageRecord {
  feedbackRating: "negative" | "positive" | null;
  feedbackReason: string | null;
  feedbackNote: string | null;
  feedbackUpdatedAtMs: number | null;
}

export async function listCompanionConversationMessages(input: {
  beforeMs?: number;
  conversationId: string;
  database: D1Database | undefined;
  limit: number;
  userId: string;
}): Promise<CompanionConversationMessageWithFeedback[]> {
  const db = createD1Client(input.database);
  const conditions: SQL[] = [
    eq(companionConversationMessages.conversationId, input.conversationId),
    eq(companionConversationMessages.userId, input.userId),
  ];

  if (input.beforeMs !== undefined) {
    conditions.push(
      sql`${companionConversationMessages.createdAtMs} < ${input.beforeMs}`,
    );
  }

  try {
    const rows = await db
      .select({
        content: companionConversationMessages.content,
        conversationId: companionConversationMessages.conversationId,
        createdAtMs: companionConversationMessages.createdAtMs,
        feedbackNote: companionMessageFeedbacks.note,
        feedbackRating: companionMessageFeedbacks.rating,
        feedbackReason: companionMessageFeedbacks.reason,
        feedbackUpdatedAtMs: companionMessageFeedbacks.updatedAtMs,
        id: companionConversationMessages.id,
        metadataJson: companionConversationMessages.metadataJson,
        role: companionConversationMessages.role,
        status: companionConversationMessages.status,
        userId: companionConversationMessages.userId,
      })
      .from(companionConversationMessages)
      .leftJoin(
        companionMessageFeedbacks,
        and(
          eq(
            companionMessageFeedbacks.messageId,
            companionConversationMessages.id,
          ),
          eq(companionMessageFeedbacks.userId, input.userId),
        ),
      )
      .where(and(...conditions))
      .orderBy(
        desc(companionConversationMessages.createdAtMs),
        desc(companionConversationMessages.id),
      )
      .limit(input.limit);

    return rows.reverse();
  } catch (error) {
    console.error("读取消息反馈失败，退回无反馈消息列表", { error });

    const rows = await db
      .select()
      .from(companionConversationMessages)
      .where(and(...conditions))
      .orderBy(
        desc(companionConversationMessages.createdAtMs),
        desc(companionConversationMessages.id),
      )
      .limit(input.limit);

    return rows.reverse().map((message) => ({
      ...message,
      feedbackNote: null,
      feedbackRating: null,
      feedbackReason: null,
      feedbackUpdatedAtMs: null,
    }));
  }
}

export async function insertCompanionConversationMessage(input: {
  content: string;
  conversationId: string;
  database: D1Database | undefined;
  id: string;
  metadataJson?: string | null;
  nowMs: number;
  role: "assistant" | "user";
  summary?: string | null;
  userId: string;
}) {
  const db = createD1Client(input.database);

  await db.batch([
    db.insert(companionConversationMessages).values({
      content: input.content,
      conversationId: input.conversationId,
      createdAtMs: input.nowMs,
      id: input.id,
      metadataJson: input.metadataJson ?? null,
      role: input.role,
      status: "completed",
      userId: input.userId,
    }),
    db
      .update(companionConversations)
      .set({
        lastMessageAtMs: input.nowMs,
        messageCount: sql`${companionConversations.messageCount} + 1`,
        ...(input.summary === undefined ? {} : { summary: input.summary }),
        updatedAtMs: input.nowMs,
      })
      .where(
        and(
          eq(companionConversations.id, input.conversationId),
          eq(companionConversations.userId, input.userId),
        ),
      ),
  ]);
}

export async function listActiveCompanionMemories(input: {
  database: D1Database | undefined;
  limit: number;
  userId: string;
}) {
  const db = createD1Client(input.database);

  return db
    .select()
    .from(companionMemories)
    .where(
      and(
        eq(companionMemories.userId, input.userId),
        eq(companionMemories.status, "active"),
      ),
    )
    .orderBy(
      desc(companionMemories.importance),
      desc(companionMemories.updatedAtMs),
    )
    .limit(input.limit);
}

export async function listCompanionMemories(input: {
  database: D1Database | undefined;
  userId: string;
}) {
  const db = createD1Client(input.database);

  return db
    .select({
      content: companionMemories.content,
      createdAtMs: companionMemories.createdAtMs,
      id: companionMemories.id,
      importance: companionMemories.importance,
      sourceMessageContent: companionConversationMessages.content,
      sourceMessageCreatedAtMs: companionConversationMessages.createdAtMs,
      sourceMessageId: companionMemories.sourceMessageId,
      sourceMessageRole: companionConversationMessages.role,
      status: companionMemories.status,
      type: companionMemories.type,
      updatedAtMs: companionMemories.updatedAtMs,
    })
    .from(companionMemories)
    .leftJoin(
      companionConversationMessages,
      and(
        eq(companionConversationMessages.id, companionMemories.sourceMessageId),
        eq(companionConversationMessages.userId, input.userId),
      ),
    )
    .where(
      and(
        eq(companionMemories.userId, input.userId),
        ne(companionMemories.status, "deleted"),
      ),
    )
    .orderBy(
      desc(companionMemories.importance),
      desc(companionMemories.updatedAtMs),
    );
}

export async function insertCompanionMemory(input: {
  content: string;
  database: D1Database | undefined;
  importance: number;
  nowMs: number;
  sourceMessageId: string;
  type: string;
  userId: string;
}) {
  const db = createD1Client(input.database);

  await db.insert(companionMemories).values({
    content: input.content,
    createdAtMs: input.nowMs,
    id: uuidv7(),
    importance: input.importance,
    sourceMessageId: input.sourceMessageId,
    status: "active",
    type: input.type,
    updatedAtMs: input.nowMs,
    userId: input.userId,
  });
}

export async function updateCompanionMemory(input: {
  database: D1Database | undefined;
  memoryId: string;
  nowMs: number;
  patch: {
    content?: string;
    importance?: number;
    status?: "active" | "deleted" | "disabled";
    type?: string;
  };
  userId: string;
}) {
  const db = createD1Client(input.database);

  const rows = await db
    .update(companionMemories)
    .set({ ...input.patch, updatedAtMs: input.nowMs })
    .where(
      and(
        eq(companionMemories.id, input.memoryId),
        eq(companionMemories.userId, input.userId),
        ne(companionMemories.status, "deleted"),
      ),
    )
    .returning();

  return rows[0] ?? null;
}

export async function findCompanionAssistantMessageForFeedback(input: {
  database: D1Database | undefined;
  messageId: string;
  userId: string;
}) {
  const db = createD1Client(input.database);

  const rows = await db
    .select()
    .from(companionConversationMessages)
    .where(
      and(
        eq(companionConversationMessages.id, input.messageId),
        eq(companionConversationMessages.userId, input.userId),
        eq(companionConversationMessages.role, "assistant"),
        eq(companionConversationMessages.status, "completed"),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertCompanionMessageFeedback(input: {
  conversationId: string;
  database: D1Database | undefined;
  messageId: string;
  note: string | null;
  nowMs: number;
  rating: "negative" | "positive";
  reason: string | null;
  userId: string;
}) {
  const db = createD1Client(input.database);

  const existing = await db
    .select()
    .from(companionMessageFeedbacks)
    .where(
      and(
        eq(companionMessageFeedbacks.userId, input.userId),
        eq(companionMessageFeedbacks.messageId, input.messageId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    const rows = await db
      .update(companionMessageFeedbacks)
      .set({
        note: input.note,
        rating: input.rating,
        reason: input.reason,
        updatedAtMs: input.nowMs,
      })
      .where(eq(companionMessageFeedbacks.id, existing[0].id))
      .returning();

    return rows[0] ?? existing[0];
  }

  const rows = await db
    .insert(companionMessageFeedbacks)
    .values({
      conversationId: input.conversationId,
      createdAtMs: input.nowMs,
      id: uuidv7(),
      messageId: input.messageId,
      note: input.note,
      rating: input.rating,
      reason: input.reason,
      updatedAtMs: input.nowMs,
      userId: input.userId,
    })
    .returning();

  return rows[0]!;
}

export async function listRecentCompanionMessageFeedbacks(input: {
  database: D1Database | undefined;
  limit: number;
  userId: string;
}) {
  const db = createD1Client(input.database);

  return db
    .select()
    .from(companionMessageFeedbacks)
    .where(eq(companionMessageFeedbacks.userId, input.userId))
    .orderBy(desc(companionMessageFeedbacks.updatedAtMs))
    .limit(input.limit);
}
