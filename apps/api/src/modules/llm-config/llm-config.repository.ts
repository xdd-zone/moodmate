import { asc, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { createD1Client } from "@/infra/db/d1";

import { llmProviderConfigs } from "./llm-config.schema";

export async function findLlmConfigList(database: D1Database | undefined) {
  const db = createD1Client(database);

  return db
    .select()
    .from(llmProviderConfigs)
    .orderBy(asc(llmProviderConfigs.createdAtMs), asc(llmProviderConfigs.id));
}

export async function findLlmConfigById(
  database: D1Database | undefined,
  id: string,
) {
  const db = createD1Client(database);
  const rows = await db
    .select()
    .from(llmProviderConfigs)
    .where(eq(llmProviderConfigs.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export async function findActiveLlmConfig(database: D1Database | undefined) {
  const db = createD1Client(database);
  const rows = await db
    .select()
    .from(llmProviderConfigs)
    .where(eq(llmProviderConfigs.isActive, 1))
    .limit(1);

  return rows[0] ?? null;
}

export async function insertLlmConfig(input: {
  api: string;
  apiKeyCiphertext: string;
  apiKeyIv: string;
  apiKeyLast4: string;
  baseUrl: string;
  database: D1Database | undefined;
  disableThinking: boolean;
  model: string;
  name: string;
  nowMs: number;
  providerName: string;
}) {
  const db = createD1Client(input.database);
  const id = uuidv7();

  await db.insert(llmProviderConfigs).values({
    api: input.api,
    apiKeyCiphertext: input.apiKeyCiphertext,
    apiKeyIv: input.apiKeyIv,
    apiKeyLast4: input.apiKeyLast4,
    baseUrl: input.baseUrl,
    createdAtMs: input.nowMs,
    disableThinking: input.disableThinking ? 1 : 0,
    id,
    isActive: 0,
    model: input.model,
    name: input.name,
    providerName: input.providerName,
    updatedAtMs: input.nowMs,
  });

  return id;
}

export async function updateLlmConfig(input: {
  api?: string;
  apiKeyCiphertext?: string;
  apiKeyIv?: string;
  apiKeyLast4?: string;
  baseUrl?: string;
  database: D1Database | undefined;
  disableThinking?: boolean;
  id: string;
  model?: string;
  name?: string;
  nowMs: number;
  providerName?: string;
}) {
  const db = createD1Client(input.database);

  await db
    .update(llmProviderConfigs)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.api !== undefined ? { api: input.api } : {}),
      ...(input.providerName !== undefined
        ? { providerName: input.providerName }
        : {}),
      ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.apiKeyCiphertext !== undefined
        ? { apiKeyCiphertext: input.apiKeyCiphertext }
        : {}),
      ...(input.apiKeyIv !== undefined ? { apiKeyIv: input.apiKeyIv } : {}),
      ...(input.apiKeyLast4 !== undefined
        ? { apiKeyLast4: input.apiKeyLast4 }
        : {}),
      ...(input.disableThinking !== undefined
        ? { disableThinking: input.disableThinking ? 1 : 0 }
        : {}),
      updatedAtMs: input.nowMs,
    })
    .where(eq(llmProviderConfigs.id, input.id));
}

export async function activateLlmConfig(input: {
  database: D1Database | undefined;
  id: string;
  nowMs: number;
}) {
  const db = createD1Client(input.database);

  await db.batch([
    db
      .update(llmProviderConfigs)
      .set({ isActive: 0, updatedAtMs: input.nowMs })
      .where(eq(llmProviderConfigs.isActive, 1)),
    db
      .update(llmProviderConfigs)
      .set({ isActive: 1, updatedAtMs: input.nowMs })
      .where(eq(llmProviderConfigs.id, input.id)),
  ]);
}

export async function deleteLlmConfig(input: {
  database: D1Database | undefined;
  id: string;
}) {
  const db = createD1Client(input.database);

  await db
    .delete(llmProviderConfigs)
    .where(eq(llmProviderConfigs.id, input.id));
}
