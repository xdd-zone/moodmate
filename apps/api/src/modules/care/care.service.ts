import {
  BizCode,
  type CompanionCareEvent,
  type CompanionCarePlan,
  type CompanionCareScene,
  type CompanionCareFrequency,
  type UpsertCompanionCarePlanRequest,
} from "@repo/contracts";
import { uuidv7 } from "uuidv7";

import { generateText, type AiMessage, type AiModel } from "@/infra/ai";
import { createAiCallObserver } from "@/modules/ai-usage";
import {
  findAccessibleAgent,
  getOrCreateDirectChat,
  insertDirectMessage,
  listDirectMessages,
} from "@/modules/direct-chat/direct-chat.repository";
import { resolveActiveLlmProviderConfig } from "@/modules/llm-config/llm-config.service";
import type { UserAgentRecord } from "@/modules/agents/agents.schema";
import { AppError } from "@/shared/app-error";
import type { ApiBindings } from "@/shared/hono-env";

import {
  findCarePlan,
  findCarePlanAgent,
  insertCareEvent,
  listCareEvents,
  markCareEventsRead,
  upsertCarePlan,
  type CarePlanRow,
} from "./care.repository";

const DEFAULT_SCENES: CompanionCareScene[] = ["morning", "long_absence"];
const CARE_EVENT_LIMIT = 20;

function isScene(value: string): value is CompanionCareScene {
  return [
    "morning",
    "night",
    "long_absence",
    "stress_support",
    "relationship_warmup",
    "anniversary",
  ].includes(value);
}

function scenesFromJson(value: string): CompanionCareScene[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const scenes = parsed.filter(
        (item): item is CompanionCareScene =>
          typeof item === "string" && isScene(item),
      );
      if (scenes.length > 0) return scenes;
    }
  } catch {
    // 无法解析时使用默认场景。
  }
  return [...DEFAULT_SCENES];
}

function calculateNextRunAtMs(input: {
  enabled: boolean;
  frequency: CompanionCareFrequency;
  nowMs: number;
  preferredTime: string | null;
}) {
  if (!input.enabled) return null;
  const next = new Date(input.nowMs);
  if (input.preferredTime) {
    const [hour, minute] = input.preferredTime.split(":").map(Number);
    if (Number.isFinite(hour) && Number.isFinite(minute))
      next.setHours(
        Math.min(23, Math.max(0, hour)),
        Math.min(59, Math.max(0, minute)),
        0,
        0,
      );
  }
  if (next.getTime() <= input.nowMs)
    next.setDate(next.getDate() + (input.frequency === "weekly" ? 7 : 1));
  return next.getTime();
}

function presentPlan(
  row: CarePlanRow,
  agent: UserAgentRecord | null,
): CompanionCarePlan {
  return {
    agent: agent ? { ...agent, editable: agent.source === "user" } : null,
    agentId: row.agentId,
    createdAtMs: row.createdAtMs,
    customPrompt: row.customPrompt,
    enabled: row.enabled === 1,
    frequency: row.frequency,
    id: row.id,
    nextRunAtMs: row.nextRunAtMs,
    preferredTime: row.preferredTime,
    scenes: scenesFromJson(row.scenesJson),
    tone: row.tone,
    updatedAtMs: row.updatedAtMs,
  };
}

async function getOrCreatePlan(input: {
  bindings: ApiBindings;
  userId: string;
}) {
  const existing = await findCarePlan({
    database: input.bindings.DB,
    userId: input.userId,
  });
  if (existing) return existing;
  const nowMs = Date.now();
  await upsertCarePlan({
    agentId: null,
    customPrompt: null,
    database: input.bindings.DB,
    enabled: false,
    frequency: "daily",
    nextRunAtMs: null,
    nowMs,
    preferredTime: null,
    scenes: DEFAULT_SCENES,
    tone: "gentle",
    userId: input.userId,
  });
  const created = await findCarePlan({
    database: input.bindings.DB,
    userId: input.userId,
  });
  if (!created)
    throw new AppError(
      BizCode.SYSTEM_DATABASE_UNAVAILABLE,
      "无法读取关怀计划，请确认 D1 已完成最新迁移",
      503,
    );
  return created;
}

export async function getCarePlan(input: {
  bindings: ApiBindings;
  userId: string;
}) {
  const plan = await getOrCreatePlan(input);
  const agent = plan.agentId
    ? await findCarePlanAgent({
        agentId: plan.agentId,
        database: input.bindings.DB,
        userId: input.userId,
      })
    : null;
  return { plan: presentPlan(plan, agent) };
}

export async function updateCarePlan(input: {
  bindings: ApiBindings;
  payload: UpsertCompanionCarePlanRequest;
  userId: string;
}) {
  const agent = input.payload.agentId
    ? await findAccessibleAgent({
        agentId: input.payload.agentId,
        database: input.bindings.DB,
        userId: input.userId,
      })
    : null;
  if (input.payload.enabled && !agent)
    throw new AppError(
      BizCode.AGENT_UNAVAILABLE,
      "开启主动关怀前请选择可用朋友",
      409,
    );
  const nowMs = Date.now();
  await upsertCarePlan({
    agentId: agent?.id ?? null,
    customPrompt: input.payload.customPrompt?.trim() || null,
    database: input.bindings.DB,
    enabled: input.payload.enabled,
    frequency: input.payload.frequency,
    nextRunAtMs: calculateNextRunAtMs({
      enabled: input.payload.enabled,
      frequency: input.payload.frequency,
      nowMs,
      preferredTime: input.payload.preferredTime?.trim() || null,
    }),
    nowMs,
    preferredTime: input.payload.preferredTime?.trim() || null,
    scenes: input.payload.scenes,
    tone: input.payload.tone,
    userId: input.userId,
  });
  return getCarePlan(input);
}

export async function getCareEvents(input: {
  bindings: ApiBindings;
  userId: string;
}): Promise<{ items: CompanionCareEvent[] }> {
  const rows = await listCareEvents({
    database: input.bindings.DB,
    limit: CARE_EVENT_LIMIT,
    userId: input.userId,
  });
  await markCareEventsRead({
    database: input.bindings.DB,
    nowMs: Date.now(),
    userId: input.userId,
  });
  return {
    items: rows.map(({ event, message }) => ({
      agentId: event.agentId,
      generatedAtMs: event.generatedAtMs,
      id: event.id,
      message,
      messageId: event.messageId,
      readAtMs: event.readAtMs,
      scene: isScene(event.scene) ? event.scene : "long_absence",
      status: event.status,
    })),
  };
}

export async function generateCareEvent(input: {
  bindings: ApiBindings;
  requestId: string;
  scene?: CompanionCareScene;
  signal: AbortSignal;
  userId: string;
}) {
  const { plan } = await getCarePlan(input);
  if (!plan.enabled || !plan.agentId || !plan.agent)
    throw new AppError(
      BizCode.AGENT_UNAVAILABLE,
      "请先选择并启用关怀朋友",
      409,
    );
  const scene = input.scene ?? plan.scenes[0] ?? "long_absence";
  const direct = await getOrCreateDirectChat({
    agentId: plan.agentId,
    database: input.bindings.DB,
    nowMs: Date.now(),
    userId: input.userId,
  });
  const config = await resolveActiveLlmProviderConfig(input.bindings);
  const model = config as AiModel;
  const history = (
    await listDirectMessages({
      conversationId: direct.conversation.id,
      database: input.bindings.DB,
      limit: 12,
    })
  ).map(
    (message): AiMessage => ({ content: message.content, role: message.role }),
  );
  const result = await generateText({
    model,
    messages: [
      {
        role: "system",
        content: `你是${plan.agent.name}。请主动给用户发一条简短、自然的中文关怀消息。场景：${scene}。${plan.customPrompt ?? ""}`,
      },
      ...history,
    ],
    maxTokens: 240,
    observer: createAiCallObserver({
      agent: {
        id: plan.agent.id,
        name: plan.agent.name,
        source: plan.agent.source,
      },
      bindings: input.bindings,
      conversationId: direct.conversation.id,
      conversationType: "direct",
      initiatorId: input.userId,
      initiatorType: "system",
      llmConfigId: config.id,
      model,
      requestId: input.requestId,
      scenario: "direct_care_generation",
      subjectType: "agent",
      userId: input.userId,
    }),
    signal: input.signal,
  });
  const message = result.message.content.trim();
  if (!message)
    throw new AppError(
      BizCode.SYSTEM_INTERNAL_ERROR,
      "模型没有返回关怀消息",
      503,
    );
  const nowMs = Date.now();
  const stored = await insertDirectMessage({
    conversationId: direct.conversation.id,
    content: message,
    database: input.bindings.DB,
    nowMs,
    role: "assistant",
    status: "completed",
    turnId: uuidv7(),
  });
  const event = await insertCareEvent({
    agentId: plan.agentId,
    carePlanId: plan.id,
    conversationId: direct.conversation.id,
    database: input.bindings.DB,
    generatedAtMs: nowMs,
    messageId: stored.id,
    scene,
    userId: input.userId,
  });
  return {
    event: {
      agentId: event.agentId,
      generatedAtMs: event.generatedAtMs,
      id: event.id,
      message,
      messageId: event.messageId,
      readAtMs: null,
      scene,
      status: event.status,
    },
  };
}
