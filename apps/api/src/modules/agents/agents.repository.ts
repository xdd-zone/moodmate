import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { createD1Client } from "@/infra/db/d1";

import {
  agentConversationMessages,
  agentConversations,
  agentMemories,
  userAgents,
  type UserAgentRecord,
} from "./agents.schema";

export interface CreateUserAgentInput {
  defaultPrompt: string | null;
  description: string | null;
  guardrailsPrompt: string | null;
  headline: string | null;
  imageKey: string | null;
  name: string;
  personaPrompt: string | null;
  storyBackground: string | null;
  tonePrompt: string | null;
}

export async function createUserAgent(input: {
  database: D1Database | undefined;
  nowMs: number;
  userId: string;
  values: CreateUserAgentInput;
}): Promise<UserAgentRecord> {
  const db = createD1Client(input.database);

  const rows = await db
    .insert(userAgents)
    .values({
      createdAtMs: input.nowMs,
      defaultPrompt: input.values.defaultPrompt,
      description: input.values.description,
      guardrailsPrompt: input.values.guardrailsPrompt,
      headline: input.values.headline,
      id: uuidv7(),
      imageKey: input.values.imageKey,
      name: input.values.name,
      personaPrompt: input.values.personaPrompt,
      status: "active",
      source: "user",
      storyBackground: input.values.storyBackground,
      tonePrompt: input.values.tonePrompt,
      updatedAtMs: input.nowMs,
      ownerUserId: input.userId,
    })
    .returning();

  return rows[0]!;
}

export async function listUserAgents(input: {
  database: D1Database | undefined;
  userId: string;
}): Promise<UserAgentRecord[]> {
  const db = createD1Client(input.database);

  return db
    .select()
    .from(userAgents)
    .where(
      and(
        eq(userAgents.status, "active"),
        or(
          eq(userAgents.source, "system"),
          and(
            eq(userAgents.source, "user"),
            eq(userAgents.ownerUserId, input.userId),
          ),
        ),
      ),
    )
    .orderBy(desc(userAgents.updatedAtMs), desc(userAgents.id));
}

export async function getUserAgentById(input: {
  agentId: string;
  database: D1Database | undefined;
  userId: string;
}): Promise<UserAgentRecord | null> {
  const db = createD1Client(input.database);

  const rows = await db
    .select()
    .from(userAgents)
    .where(
      and(
        eq(userAgents.id, input.agentId),
        or(
          eq(userAgents.source, "system"),
          and(
            eq(userAgents.source, "user"),
            eq(userAgents.ownerUserId, input.userId),
          ),
        ),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function listAccessibleAgentsByIds(input: {
  agentIds: string[];
  database: D1Database | undefined;
  userId: string;
}): Promise<UserAgentRecord[]> {
  if (input.agentIds.length === 0) {
    return [];
  }

  const db = createD1Client(input.database);

  return db
    .select()
    .from(userAgents)
    .where(
      and(
        inArray(userAgents.id, input.agentIds),
        eq(userAgents.status, "active"),
        or(
          eq(userAgents.source, "system"),
          and(
            eq(userAgents.source, "user"),
            eq(userAgents.ownerUserId, input.userId),
          ),
        ),
      ),
    );
}

export async function listActiveAgentMemories(input: {
  agentId: string;
  database: D1Database | undefined;
  limit: number;
  userId: string;
}) {
  const db = createD1Client(input.database);

  return db
    .select()
    .from(agentMemories)
    .where(
      and(
        eq(agentMemories.userId, input.userId),
        eq(agentMemories.agentId, input.agentId),
        eq(agentMemories.status, "active"),
      ),
    )
    .orderBy(desc(agentMemories.importance), desc(agentMemories.updatedAtMs))
    .limit(input.limit);
}

export async function insertAgentMemory(input: {
  agentId: string;
  content: string;
  database: D1Database | undefined;
  importance: number;
  nowMs: number;
  sourceMessageId: string;
  type: string;
  userId: string;
}) {
  const db = createD1Client(input.database);
  const memory = {
    agentId: input.agentId,
    content: input.content,
    createdAtMs: input.nowMs,
    id: uuidv7(),
    importance: input.importance,
    sourceMessageId: input.sourceMessageId,
    status: "active" as const,
    type: input.type,
    updatedAtMs: input.nowMs,
    userId: input.userId,
  };

  await db.insert(agentMemories).values(memory);
  return memory;
}

export async function listAgentMemories(input: {
  agentId: string;
  database: D1Database | undefined;
  userId: string;
}) {
  const db = createD1Client(input.database);

  return db
    .select({ memory: agentMemories, sourceMessage: agentConversationMessages })
    .from(agentMemories)
    .leftJoin(
      agentConversationMessages,
      eq(agentConversationMessages.id, agentMemories.sourceMessageId),
    )
    .leftJoin(
      agentConversations,
      eq(agentConversations.id, agentConversationMessages.conversationId),
    )
    .where(
      and(
        eq(agentMemories.userId, input.userId),
        eq(agentMemories.agentId, input.agentId),
        ne(agentMemories.status, "deleted"),
        or(
          isNull(agentMemories.sourceMessageId),
          and(
            eq(agentConversations.userId, input.userId),
            eq(agentConversations.agentId, input.agentId),
          ),
        ),
      ),
    )
    .orderBy(desc(agentMemories.importance), desc(agentMemories.updatedAtMs));
}

export interface UpdateAgentMemoryPatch {
  content?: string;
  importance?: number;
  status?: "active" | "disabled" | "deleted";
  type?: string;
}

export async function updateAgentMemory(input: {
  agentId: string;
  database: D1Database | undefined;
  memoryId: string;
  nowMs: number;
  patch: UpdateAgentMemoryPatch;
  userId: string;
}) {
  const db = createD1Client(input.database);

  const rows = await db
    .update(agentMemories)
    .set({ ...input.patch, updatedAtMs: input.nowMs })
    .where(
      and(
        eq(agentMemories.id, input.memoryId),
        eq(agentMemories.agentId, input.agentId),
        eq(agentMemories.userId, input.userId),
        ne(agentMemories.status, "deleted"),
      ),
    )
    .returning();

  return rows[0] ?? null;
}

export async function deleteAgentMemory(input: {
  agentId: string;
  database: D1Database | undefined;
  memoryId: string;
  nowMs: number;
  userId: string;
}) {
  const db = createD1Client(input.database);

  const rows = await db
    .update(agentMemories)
    .set({ status: "deleted", updatedAtMs: input.nowMs })
    .where(
      and(
        eq(agentMemories.id, input.memoryId),
        eq(agentMemories.agentId, input.agentId),
        eq(agentMemories.userId, input.userId),
        ne(agentMemories.status, "deleted"),
      ),
    )
    .returning({ id: agentMemories.id });

  return rows.length > 0;
}

export interface UpdateUserAgentPatch {
  defaultPrompt?: string | null;
  description?: string | null;
  guardrailsPrompt?: string | null;
  headline?: string | null;
  imageKey?: string | null;
  name?: string;
  personaPrompt?: string | null;
  storyBackground?: string | null;
  tonePrompt?: string | null;
}

export async function updateUserAgent(input: {
  agentId: string;
  database: D1Database | undefined;
  nowMs: number;
  patch: UpdateUserAgentPatch;
  userId: string;
}): Promise<UserAgentRecord | null> {
  const db = createD1Client(input.database);

  const rows = await db
    .update(userAgents)
    .set({ ...input.patch, updatedAtMs: input.nowMs })
    .where(
      and(
        eq(userAgents.id, input.agentId),
        eq(userAgents.source, "user"),
        eq(userAgents.ownerUserId, input.userId),
        eq(userAgents.status, "active"),
      ),
    )
    .returning();

  return rows[0] ?? null;
}

export async function archiveUserAgent(input: {
  agentId: string;
  database: D1Database | undefined;
  nowMs: number;
  userId: string;
}): Promise<UserAgentRecord | null> {
  const db = createD1Client(input.database);

  const rows = await db
    .update(userAgents)
    .set({ status: "archived", updatedAtMs: input.nowMs })
    .where(
      and(
        eq(userAgents.id, input.agentId),
        eq(userAgents.source, "user"),
        eq(userAgents.ownerUserId, input.userId),
        eq(userAgents.status, "active"),
      ),
    )
    .returning();

  return rows[0] ?? null;
}

export const listOwnedUserAgentsByIds = listAccessibleAgentsByIds;
