import { and, desc, eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { createD1Client } from "@/infra/db/d1";

import {
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
      storyBackground: input.values.storyBackground,
      tonePrompt: input.values.tonePrompt,
      updatedAtMs: input.nowMs,
      userId: input.userId,
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
      and(eq(userAgents.userId, input.userId), eq(userAgents.status, "active")),
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
        eq(userAgents.userId, input.userId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function listOwnedUserAgentsByIds(input: {
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
        eq(userAgents.userId, input.userId),
        inArray(userAgents.id, input.agentIds),
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
        eq(userAgents.userId, input.userId),
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
        eq(userAgents.userId, input.userId),
        eq(userAgents.status, "active"),
      ),
    )
    .returning();

  return rows[0] ?? null;
}
