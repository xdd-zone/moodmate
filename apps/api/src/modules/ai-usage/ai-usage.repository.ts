import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { createD1Client } from "@/infra/db/d1";
import { aiCallRecords } from "./ai-usage.schema";

export async function insertAiCall(
  input: typeof aiCallRecords.$inferInsert & {
    database: D1Database | undefined;
  },
) {
  const db = createD1Client(input.database);
  const record = { ...input };
  delete (record as { database?: D1Database }).database;
  await db.insert(aiCallRecords).values(record);
}

export async function completeAiCall(input: {
  callId: string;
  database: D1Database | undefined;
  durationMs: number;
  finishReason: string;
  finishedAtMs: number;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
}) {
  const db = createD1Client(input.database);
  await db
    .update(aiCallRecords)
    .set({
      completionTokens: input.usage?.completionTokens ?? null,
      durationMs: input.durationMs,
      finishReason: input.finishReason,
      finishedAtMs: input.finishedAtMs,
      promptTokens: input.usage?.promptTokens ?? null,
      status: "completed",
      totalTokens: input.usage?.totalTokens ?? null,
      usageStatus: input.usage ? "reported" : "unavailable",
    })
    .where(eq(aiCallRecords.id, input.callId));
}

export async function failAiCall(input: {
  callId: string;
  database: D1Database | undefined;
  durationMs: number;
  errorCode: string;
  errorMessage: string | null;
  finishReason: string | null;
  finishedAtMs: number;
  status: "failed" | "aborted";
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
}) {
  const db = createD1Client(input.database);
  await db
    .update(aiCallRecords)
    .set({
      durationMs: input.durationMs,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      finishReason: input.finishReason,
      finishedAtMs: input.finishedAtMs,
      promptTokens: input.usage?.promptTokens ?? null,
      completionTokens: input.usage?.completionTokens ?? null,
      totalTokens: input.usage?.totalTokens ?? null,
      status: input.status,
      usageStatus: input.usage ? "reported" : "unavailable",
    })
    .where(eq(aiCallRecords.id, input.callId));
}

export function newAiCallId() {
  return uuidv7();
}
