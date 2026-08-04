import { and, desc, eq, isNull, or } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { createD1Client } from "@/infra/db/d1";
import {
  agentCareEvents,
  agentCarePlans,
  agentConversationMessages,
  agents,
  type AgentCarePlanRecord,
} from "@/modules/agents/agents.schema";

export async function findCarePlan(input: {
  database: D1Database | undefined;
  userId: string;
}) {
  const db = createD1Client(input.database);
  const rows = await db
    .select()
    .from(agentCarePlans)
    .where(eq(agentCarePlans.userId, input.userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function findCarePlanAgent(input: {
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
        or(
          eq(agents.source, "system"),
          and(eq(agents.source, "user"), eq(agents.ownerUserId, input.userId)),
        ),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertCarePlan(input: {
  agentId: string | null;
  database: D1Database | undefined;
  enabled: boolean;
  frequency: "daily" | "weekly" | "custom";
  preferredTime: string | null;
  scenes: string[];
  tone: "light" | "gentle" | "intimate";
  customPrompt: string | null;
  nextRunAtMs: number | null;
  nowMs: number;
  userId: string;
}) {
  const db = createD1Client(input.database);
  const existing = await findCarePlan({
    database: input.database,
    userId: input.userId,
  });
  const values = {
    agentId: input.agentId,
    customPrompt: input.customPrompt,
    enabled: input.enabled ? 1 : 0,
    frequency: input.frequency,
    nextRunAtMs: input.nextRunAtMs,
    preferredTime: input.preferredTime,
    scenesJson: JSON.stringify(input.scenes),
    tone: input.tone,
    updatedAtMs: input.nowMs,
  };

  if (existing) {
    await db
      .update(agentCarePlans)
      .set(values)
      .where(eq(agentCarePlans.id, existing.id));
    return existing.id;
  }

  const id = uuidv7();
  await db
    .insert(agentCarePlans)
    .values({ ...values, createdAtMs: input.nowMs, id, userId: input.userId });
  return id;
}

export async function listCareEvents(input: {
  database: D1Database | undefined;
  limit: number;
  userId: string;
}) {
  const db = createD1Client(input.database);
  return db
    .select({
      event: agentCareEvents,
      message: agentConversationMessages.content,
      agentName: agents.name,
    })
    .from(agentCareEvents)
    .innerJoin(
      agentConversationMessages,
      eq(agentConversationMessages.id, agentCareEvents.messageId),
    )
    .innerJoin(agents, eq(agents.id, agentCareEvents.agentId))
    .where(eq(agentCareEvents.userId, input.userId))
    .orderBy(desc(agentCareEvents.generatedAtMs), desc(agentCareEvents.id))
    .limit(input.limit);
}

export async function insertCareEvent(input: {
  agentId: string;
  carePlanId: string;
  conversationId: string;
  database: D1Database | undefined;
  generatedAtMs: number;
  messageId: string;
  scene: string;
  userId: string;
}) {
  const db = createD1Client(input.database);
  const event = {
    agentId: input.agentId,
    carePlanId: input.carePlanId,
    conversationId: input.conversationId,
    generatedAtMs: input.generatedAtMs,
    id: uuidv7(),
    messageId: input.messageId,
    readAtMs: null,
    scene: input.scene,
    status: "generated" as const,
    userId: input.userId,
  };
  await db.insert(agentCareEvents).values(event);
  return event;
}

export async function markCareEventsRead(input: {
  database: D1Database | undefined;
  nowMs: number;
  userId: string;
}) {
  const db = createD1Client(input.database);
  await db
    .update(agentCareEvents)
    .set({ readAtMs: input.nowMs, status: "read" })
    .where(
      and(
        eq(agentCareEvents.userId, input.userId),
        eq(agentCareEvents.status, "generated"),
        isNull(agentCareEvents.readAtMs),
      ),
    );
}

export type CarePlanRow = AgentCarePlanRecord;
