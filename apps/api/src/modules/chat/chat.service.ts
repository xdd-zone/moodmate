import {
  BizCode,
  CompanionMessageFeedbackReasonSchema,
  type CompanionCareEvent,
  type CompanionCareFrequency,
  type CompanionCarePlan,
  type CompanionCareScene,
  type CompanionCareTone,
  type CompanionChatLlmConfig,
  type CompanionChatMessage,
  type CompanionMemory,
  type CompanionMessageFeedback,
  type ConversationEmotion,
  type ConversationIntent,
  type ConversationRelationshipStage,
  type ConversationSafety,
  type EmotionRoute,
  type LlmConfigApi,
  type ReplyPolicy,
  type SubmitCompanionMessageFeedbackRequest,
  type UpdateCompanionMemoryRequest,
  type UpsertCompanionCarePlanRequest,
} from "@repo/contracts";
import { uuidv7 } from "uuidv7";

import { resolveActiveLlmProviderConfig } from "@/modules/llm-config/llm-config.service";
import { AppError } from "@/shared/app-error";
import type { ApiBindings } from "@/shared/hono-env";

import {
  analyzeConversationSafety,
  analyzeConversationUnderstanding,
  buildBoundaryResponse,
  extractCompanionMemoriesWithLangChain,
  getEmotionRouteSystemInstruction,
  getIntentSystemInstruction,
  getRelationshipStageSystemInstruction,
  getReplyPolicySystemInstruction,
  getSafetySystemInstruction,
  buildConversationAnalysisMetadata,
  evaluateReplyQuality,
  judgeCompanionMemoryCandidate,
  toAssistantReplyQualityMetadata,
} from "./chat.analysis";
import {
  countUnreadCareEvents,
  findCompanionAssistantMessageForFeedback,
  findCompanionCarePlan,
  getCompanionProfile,
  getOrCreateCompanionConversation,
  insertCompanionCareEvent,
  insertCompanionConversationMessage,
  insertCompanionMemory,
  listActiveCompanionMemories,
  listCompanionCareEvents,
  listCompanionConversationMessages,
  listCompanionMemories,
  listRecentCompanionMessageFeedbacks,
  markCompanionCareEventsRead,
  updateCompanionMemory as updateStoredCompanionMemory,
  upsertCompanionCarePlan,
  upsertCompanionMessageFeedback,
  type CompanionCarePlanRow,
} from "./chat.repository";
import {
  presentCompanionConversationMessage,
  presentCompanionMemory,
  presentCompanionMemoryWithSource,
} from "./chat.presenter";

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatProviderConfig extends CompanionChatLlmConfig {
  api: LlmConfigApi;
  disableThinking: boolean;
}

export interface PreparedCompanionChat {
  boundaryResponse: string;
  messages: ChatCompletionMessage[];
  providerConfig: ChatProviderConfig;
  turn: {
    allowMemoryExtraction: boolean;
    conversationId: string;
    previousSummary: string | null;
    providerConfig: ChatProviderConfig;
    recentMessages: Array<{ content: string; role: "assistant" | "user" }>;
    replyPolicy: ReplyPolicy | null;
    sourceUserMessageId: string;
    userId: string;
    userText: string;
  };
}

export const COMPANION_INITIAL_HISTORY_LIMIT = 40;

const COMPANION_RECENT_MESSAGE_LIMIT = 18;
const COMPANION_MEMORY_INJECTION_LIMIT = 12;
const COMPANION_FEEDBACK_INJECTION_LIMIT = 5;
const COMPANION_MEMORY_EXTRACTION_LIMIT = 2;
const COMPANION_MEMORY_DEDUPLICATION_LIMIT = 50;
const MEMORY_TRIGGER_PATTERN =
  /我|不喜欢|喜欢|希望|想要|以后|记住|别|不要|需要|习惯|倾向/;
const HIGH_IMPORTANCE_MEMORY_PATTERN = /记住|不要|不喜欢|边界|以后/;

const COMPANION_SYSTEM_PROMPT = [
  "你是 MoodMate AI 伴侣，也是用户的虚拟朋友。",
  "请使用自然、尊重、不过度依赖的中文交流，认真回应用户此刻表达的内容。",
  "你不是医生、心理咨询师或治疗工具，不提供诊断、疗效承诺，也不把回复描述成医疗建议。",
  "如果用户提到现实危险或紧急情况，鼓励其联系当地紧急服务或可信任的人，不要假装能提供线下救援。",
].join("\n");

export async function getCompanionConversation(input: {
  bindings: ApiBindings;
  userId: string;
}) {
  const conversation = await requireCompanionConversation(input);

  // 主动关怀是增强能力：未读统计与已读标记独立 try/catch，新表不可用不能拖垮会话主链路。
  let hasUnreadCareEvent = false;
  try {
    const unreadCount = await countUnreadCareEvents({
      database: input.bindings.DB,
      userId: input.userId,
    });
    hasUnreadCareEvent = unreadCount > 0;
  } catch (error) {
    console.warn("读取未读关怀事件失败，按无未读处理", { error });
  }

  try {
    await markCompanionCareEventsRead({
      database: input.bindings.DB,
      nowMs: Date.now(),
      userId: input.userId,
    });
  } catch (error) {
    console.warn("标记关怀事件已读失败，跳过", { error });
  }

  const messages = await listCompanionConversationMessages({
    conversationId: conversation.id,
    database: input.bindings.DB,
    limit: COMPANION_INITIAL_HISTORY_LIMIT,
    userId: input.userId,
  });

  return {
    conversationId: conversation.id,
    hasUnreadCareEvent,
    messageCount: conversation.messageCount,
    messages: messages.map(presentCompanionConversationMessage),
    nextCursor: getOldestMessageCursor(
      messages,
      COMPANION_INITIAL_HISTORY_LIMIT,
    ),
    summary: conversation.summary,
    title: conversation.title,
  };
}

export async function getCompanionConversationMessages(input: {
  beforeMs: number;
  bindings: ApiBindings;
  userId: string;
}) {
  const conversation = await requireCompanionConversation(input);
  const messages = await listCompanionConversationMessages({
    beforeMs: input.beforeMs,
    conversationId: conversation.id,
    database: input.bindings.DB,
    limit: COMPANION_INITIAL_HISTORY_LIMIT,
    userId: input.userId,
  });

  return {
    messages: messages.map(presentCompanionConversationMessage),
    nextCursor: getOldestMessageCursor(
      messages,
      COMPANION_INITIAL_HISTORY_LIMIT,
    ),
  };
}

export async function getCompanionMemories(input: {
  bindings: ApiBindings;
  userId: string;
}) {
  const memories = await listCompanionMemories({
    database: input.bindings.DB,
    userId: input.userId,
  });

  return { items: memories.map(presentCompanionMemoryWithSource) };
}

export async function updateCompanionMemory(input: {
  bindings: ApiBindings;
  memoryId: string;
  patch: UpdateCompanionMemoryRequest;
  userId: string;
}): Promise<{ memory: CompanionMemory }> {
  const memory = await updateStoredCompanionMemory({
    database: input.bindings.DB,
    memoryId: input.memoryId,
    nowMs: Date.now(),
    patch: input.patch,
    userId: input.userId,
  });

  if (!memory) {
    throw new AppError(
      BizCode.COMMON_NOT_FOUND,
      "没有找到这条记忆，刷新列表后重试",
      404,
    );
  }

  return { memory: presentCompanionMemory(memory) };
}

export async function deleteCompanionMemory(input: {
  bindings: ApiBindings;
  memoryId: string;
  userId: string;
}) {
  const memory = await updateStoredCompanionMemory({
    database: input.bindings.DB,
    memoryId: input.memoryId,
    nowMs: Date.now(),
    patch: { status: "deleted" },
    userId: input.userId,
  });

  if (!memory) {
    throw new AppError(
      BizCode.COMMON_NOT_FOUND,
      "没有找到这条记忆，刷新列表后重试",
      404,
    );
  }

  return { success: true as const };
}

export async function submitCompanionMessageFeedback(input: {
  bindings: ApiBindings;
  messageId: string;
  payload: SubmitCompanionMessageFeedbackRequest;
  userId: string;
}): Promise<{ feedback: CompanionMessageFeedback }> {
  const message = await findCompanionAssistantMessageForFeedback({
    database: input.bindings.DB,
    messageId: input.messageId,
    userId: input.userId,
  });

  if (!message) {
    throw new AppError(
      BizCode.COMMON_NOT_FOUND,
      "没有找到可反馈的回复，刷新聊天记录后重试",
      404,
    );
  }

  const nowMs = Date.now();
  const record = await upsertCompanionMessageFeedback({
    conversationId: message.conversationId,
    database: input.bindings.DB,
    messageId: input.messageId,
    note: input.payload.note ?? null,
    nowMs,
    rating: input.payload.rating,
    reason: input.payload.reason ?? null,
    userId: input.userId,
  });

  const reason = CompanionMessageFeedbackReasonSchema.safeParse(record.reason);

  return {
    feedback: {
      note: record.note,
      rating: record.rating,
      reason: reason.success ? reason.data : null,
      updatedAtMs: record.updatedAtMs,
    },
  };
}

const CARE_DEFAULT_PLAN = {
  customPrompt: null,
  enabled: false,
  frequency: "daily" as const,
  preferredTime: "21:30",
  scenes: ["long_absence", "night"] as CompanionCareScene[],
  tone: "gentle" as const,
};

const CARE_EVENTS_LIST_LIMIT = 20;

const CARE_TONE_PREFIX: Record<CompanionCareTone, string> = {
  gentle: "嘿",
  intimate: "想你了",
  light: "嗨",
};

const CARE_SCENE_TEMPLATES: Record<CompanionCareScene, string> = {
  anniversary: "今天像是一个值得被记住的小节点，想陪你把这一刻轻轻收好。",
  long_absence: "你有一会儿没来了。我没有催你，只是想确认一下你还好不好。",
  morning: "早呀。今天不用一下子把自己推得太紧，先把眼前这一小步走好就可以。",
  night: "今晚先把那些没处理完的事放一放吧，能好好休息，也是一件很重要的事。",
  relationship_warmup: "刚才想到你，想留一句话在这里：慢慢来，我会认真听你说。",
  stress_support:
    "如果今天压力有点满，先深呼吸一下，我可以陪你把事情拆小一点。",
};

function getCareTonePrefix(tone: CompanionCareTone): string {
  return CARE_TONE_PREFIX[tone];
}

function buildProactiveCareMessage(input: {
  customPrompt: string | null;
  scene: CompanionCareScene;
  tone: CompanionCareTone;
}): string {
  const prefix = getCareTonePrefix(input.tone);
  const custom = input.customPrompt?.trim();

  if (custom) {
    return `${prefix}。${custom}`.slice(0, 1000);
  }

  return `${prefix}，${CARE_SCENE_TEMPLATES[input.scene]}`;
}

function calculateNextCareRunAtMs(input: {
  enabled: boolean;
  frequency: CompanionCareFrequency;
  nowMs: number;
  preferredTime: string | null;
}): number | null {
  if (!input.enabled) {
    return null;
  }

  const next = new Date(input.nowMs);

  if (input.preferredTime) {
    const [hourText, minuteText] = input.preferredTime.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);

    if (Number.isFinite(hour) && Number.isFinite(minute)) {
      next.setHours(
        Math.min(23, Math.max(0, hour)),
        Math.min(59, Math.max(0, minute)),
        0,
        0,
      );
    }
  }

  if (next.getTime() <= input.nowMs) {
    next.setDate(next.getDate() + (input.frequency === "weekly" ? 7 : 1));
  }

  return next.getTime();
}

function presentCompanionCarePlan(
  plan: CompanionCarePlanRow,
): CompanionCarePlan {
  return {
    createdAtMs: plan.createdAtMs,
    customPrompt: plan.customPrompt,
    enabled: plan.enabled,
    frequency: plan.frequency,
    id: plan.id,
    nextRunAtMs: plan.nextRunAtMs,
    preferredTime: plan.preferredTime,
    scenes: normalizeCareScenes(plan.scenes),
    tone: plan.tone,
    updatedAtMs: plan.updatedAtMs,
  };
}

function normalizeCareScenes(scenes: string[]): CompanionCareScene[] {
  const filtered = scenes.filter((scene): scene is CompanionCareScene =>
    isCareScene(scene),
  );

  return filtered.length > 0 ? filtered : [...CARE_DEFAULT_PLAN.scenes];
}

const CARE_SCENE_VALUES: readonly CompanionCareScene[] = [
  "morning",
  "night",
  "long_absence",
  "stress_support",
  "relationship_warmup",
  "anniversary",
];

function isCareScene(value: string): value is CompanionCareScene {
  return (CARE_SCENE_VALUES as readonly string[]).includes(value);
}

export async function getCompanionCarePlan(input: {
  bindings: ApiBindings;
  userId: string;
}): Promise<{ plan: CompanionCarePlan }> {
  const existing = await findCompanionCarePlan({
    database: input.bindings.DB,
    userId: input.userId,
  });

  if (existing) {
    return { plan: presentCompanionCarePlan(existing) };
  }

  const nowMs = Date.now();
  await upsertCompanionCarePlan({
    customPrompt: CARE_DEFAULT_PLAN.customPrompt,
    database: input.bindings.DB,
    enabled: CARE_DEFAULT_PLAN.enabled,
    frequency: CARE_DEFAULT_PLAN.frequency,
    nextRunAtMs: null,
    nowMs,
    preferredTime: CARE_DEFAULT_PLAN.preferredTime,
    scenes: [...CARE_DEFAULT_PLAN.scenes],
    tone: CARE_DEFAULT_PLAN.tone,
    userId: input.userId,
  });

  const created = await findCompanionCarePlan({
    database: input.bindings.DB,
    userId: input.userId,
  });

  if (!created) {
    throw new AppError(
      BizCode.SYSTEM_DATABASE_UNAVAILABLE,
      "无法读取关怀计划，请确认 D1 已完成最新迁移",
      503,
    );
  }

  return { plan: presentCompanionCarePlan(created) };
}

export async function updateCompanionCarePlan(input: {
  bindings: ApiBindings;
  payload: UpsertCompanionCarePlanRequest;
  userId: string;
}): Promise<{ plan: CompanionCarePlan }> {
  const nowMs = Date.now();
  const preferredTime = input.payload.preferredTime?.trim() || null;
  const nextRunAtMs = calculateNextCareRunAtMs({
    enabled: input.payload.enabled,
    frequency: input.payload.frequency,
    nowMs,
    preferredTime,
  });

  await upsertCompanionCarePlan({
    customPrompt: input.payload.customPrompt?.trim() || null,
    database: input.bindings.DB,
    enabled: input.payload.enabled,
    frequency: input.payload.frequency,
    nextRunAtMs,
    nowMs,
    preferredTime,
    scenes: input.payload.scenes,
    tone: input.payload.tone,
    userId: input.userId,
  });

  const plan = await findCompanionCarePlan({
    database: input.bindings.DB,
    userId: input.userId,
  });

  if (!plan) {
    throw new AppError(
      BizCode.SYSTEM_DATABASE_UNAVAILABLE,
      "无法读取关怀计划，请确认 D1 已完成最新迁移",
      503,
    );
  }

  return { plan: presentCompanionCarePlan(plan) };
}

export async function listCompanionCareEventsForUser(input: {
  bindings: ApiBindings;
  userId: string;
}): Promise<{ items: CompanionCareEvent[] }> {
  const events = await listCompanionCareEvents({
    database: input.bindings.DB,
    limit: CARE_EVENTS_LIST_LIMIT,
    userId: input.userId,
  });

  return {
    items: events.map((event) => ({
      generatedAtMs: event.generatedAtMs,
      id: event.id,
      message: event.message,
      messageId: event.messageId,
      readAtMs: event.readAtMs,
      scene: isCareScene(event.scene) ? event.scene : "long_absence",
      status: event.status,
    })),
  };
}

export async function generateCompanionCareEvent(input: {
  bindings: ApiBindings;
  scene?: CompanionCareScene;
  userId: string;
}): Promise<{ event: CompanionCareEvent }> {
  const { plan } = await getCompanionCarePlan(input);
  const scene = input.scene ?? plan.scenes[0] ?? "long_absence";
  const conversation = await requireCompanionConversation(input);

  const message = buildProactiveCareMessage({
    customPrompt: plan.customPrompt,
    scene,
    tone: plan.tone,
  });

  const nowMs = Date.now();
  const messageId = uuidv7();

  await insertCompanionConversationMessage({
    content: message,
    conversationId: conversation.id,
    database: input.bindings.DB,
    id: messageId,
    metadataJson: JSON.stringify({
      scene,
      source: "proactive_care",
      tone: plan.tone,
    }),
    nowMs,
    role: "assistant",
    userId: input.userId,
  });

  const eventId = await insertCompanionCareEvent({
    carePlanId: plan.id,
    conversationId: conversation.id,
    database: input.bindings.DB,
    message,
    messageId,
    metadataJson: JSON.stringify({
      frequency: plan.frequency,
      preferredTime: plan.preferredTime,
    }),
    nowMs,
    scene,
    userId: input.userId,
  });

  return {
    event: {
      generatedAtMs: nowMs,
      id: eventId,
      message,
      messageId,
      readAtMs: null,
      scene,
      status: "generated",
    },
  };
}

export async function prepareCompanionChat(input: {
  bindings: ApiBindings;
  conversationId?: string;
  messages: CompanionChatMessage[];
  signal: AbortSignal;
  userId: string;
}): Promise<PreparedCompanionChat> {
  const conversation = await requireCompanionConversation(input);

  if (input.conversationId && input.conversationId !== conversation.id) {
    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      "当前会话已变化，请刷新聊天记录后重试",
      400,
    );
  }

  const latestUserText = extractLatestUserText(input.messages);

  if (!latestUserText) {
    throw new AppError(BizCode.COMMON_INVALID_REQUEST, "聊天内容不能为空", 400);
  }

  const [recentMessages, activeMemories, profile, recentFeedbacks] =
    await Promise.all([
      listCompanionConversationMessages({
        conversationId: conversation.id,
        database: input.bindings.DB,
        limit: COMPANION_RECENT_MESSAGE_LIMIT,
        userId: input.userId,
      }),
      listActiveCompanionMemories({
        database: input.bindings.DB,
        limit: COMPANION_MEMORY_INJECTION_LIMIT,
        userId: input.userId,
      }),
      getCompanionProfile({
        database: input.bindings.DB,
        userId: input.userId,
      }),
      listRecentCompanionMessageFeedbacks({
        database: input.bindings.DB,
        limit: COMPANION_FEEDBACK_INJECTION_LIMIT,
        userId: input.userId,
      }).catch((error: unknown) => {
        console.error("读取最近反馈失败，跳过反馈注入", { error });
        return [] as Awaited<
          ReturnType<typeof listRecentCompanionMessageFeedbacks>
        >;
      }),
    ]);
  const agentName = profile?.displayName?.trim() || "MoodMate";
  const agentGuardrails = profile?.guardrails?.trim() || null;
  const providerConfig = await resolveProviderConfig(input.bindings);
  const analysisMemories = activeMemories.map((memory) => ({
    content: memory.content,
    importance: memory.importance,
    type: memory.type,
  }));
  const analysisRecentMessages = recentMessages.map((message) => ({
    content: message.content,
    role: message.role,
  }));

  const safety = await analyzeConversationSafety({
    activeMemories: analysisMemories,
    providerConfig,
    recentMessages: analysisRecentMessages,
    signal: input.signal,
    userText: latestUserText,
  });

  const boundaryResponse = buildBoundaryResponse(safety);

  const understanding = boundaryResponse
    ? null
    : await analyzeConversationUnderstanding({
        activeMemories: analysisMemories,
        agentGuardrails,
        agentName,
        conversationSummary: conversation.summary,
        messageCount: conversation.messageCount,
        providerConfig,
        recentMessages: analysisRecentMessages,
        safety,
        signal: input.signal,
        userText: latestUserText,
      });

  const intent = understanding?.intent ?? null;
  const emotion = understanding?.emotion ?? null;
  const relationshipStage = understanding?.relationshipStage ?? null;
  const route = understanding?.route ?? null;
  const replyPolicy = understanding?.replyPolicy ?? null;

  const sourceUserMessageId = uuidv7();
  const nowMs = Date.now();

  await insertCompanionConversationMessage({
    content: latestUserText,
    conversationId: conversation.id,
    database: input.bindings.DB,
    id: sourceUserMessageId,
    metadataJson: buildConversationAnalysisMetadata({
      emotion,
      intent,
      relationshipStage,
      replyPolicy,
      route,
      safety,
    }),
    nowMs,
    role: "user",
    userId: input.userId,
  });

  const messages: ChatCompletionMessage[] = [
    {
      content: buildSystemPrompt({
        emotion,
        feedbacks: recentFeedbacks,
        intent,
        memories: activeMemories,
        relationshipStage,
        replyPolicy,
        route,
        safety,
        summary: conversation.summary,
      }),
      role: "system",
    },
    ...recentMessages.flatMap((message) => {
      const content = normalizeStoredMessage(message.content);
      return content ? [{ content, role: message.role }] : [];
    }),
    { content: latestUserText, role: "user" },
  ];

  return {
    boundaryResponse,
    messages,
    providerConfig,
    turn: {
      allowMemoryExtraction: safety.allowMemoryExtraction,
      conversationId: conversation.id,
      previousSummary: conversation.summary,
      providerConfig,
      recentMessages,
      replyPolicy,
      sourceUserMessageId,
      userId: input.userId,
      userText: latestUserText,
    },
  };
}

export async function saveCompanionAssistantTurn(input: {
  assistantText: string;
  bindings: ApiBindings;
  turn: PreparedCompanionChat["turn"];
}) {
  const assistantText = normalizeStoredMessage(input.assistantText);

  if (!assistantText) {
    return;
  }

  const assistantMessageId = uuidv7();
  const nowMs = Date.now();
  const summary = buildConversationSummary({
    assistantText,
    previousSummary: input.turn.previousSummary,
    recentMessages: input.turn.recentMessages,
    userText: input.turn.userText,
  });

  const replyQualityGuard = evaluateReplyQuality({
    assistantText,
    replyPolicy: input.turn.replyPolicy,
  });

  await insertCompanionConversationMessage({
    content: assistantText,
    conversationId: input.turn.conversationId,
    database: input.bindings.DB,
    id: assistantMessageId,
    metadataJson: toAssistantReplyQualityMetadata({
      replyPolicy: input.turn.replyPolicy,
      guard: replyQualityGuard,
    }),
    nowMs,
    role: "assistant",
    summary,
    userId: input.turn.userId,
  });

  if (!input.turn.allowMemoryExtraction) {
    return;
  }

  try {
    await saveCandidateMemories({
      assistantText,
      bindings: input.bindings,
      previousSummary: input.turn.previousSummary,
      providerConfig: input.turn.providerConfig,
      sourceMessageId: input.turn.sourceUserMessageId,
      userId: input.turn.userId,
      userText: input.turn.userText,
    });
  } catch (error) {
    console.error("长期记忆保存失败", {
      error,
      userId: input.turn.userId,
    });
  }
}

function buildSystemPrompt(input: {
  emotion: ConversationEmotion | null;
  feedbacks: Array<{
    note: string | null;
    rating: "negative" | "positive";
    reason: string | null;
  }>;
  intent: ConversationIntent | null;
  memories: Array<{ content: string; importance: number; type: string }>;
  relationshipStage: ConversationRelationshipStage | null;
  replyPolicy: ReplyPolicy | null;
  route: EmotionRoute | null;
  safety: ConversationSafety;
  summary: string | null;
}) {
  return [
    COMPANION_SYSTEM_PROMPT,
    getSafetySystemInstruction(input.safety),
    getIntentSystemInstruction(input.intent),
    getEmotionRouteSystemInstruction({
      emotion: input.emotion,
      route: input.route,
    }),
    getRelationshipStageSystemInstruction(input.relationshipStage),
    getReplyPolicySystemInstruction(input.replyPolicy),
    getFeedbackSystemInstruction(input.feedbacks),
    input.memories.length > 0
      ? [
          "以下是用户的长期记忆，请优先尊重：",
          ...input.memories.map(
            (memory) =>
              `- [${memory.type} / 重要度 ${memory.importance}] ${memory.content}`,
          ),
        ].join("\n")
      : "",
    input.summary ? `此前对话摘要：${input.summary}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const FEEDBACK_REASON_LABELS: Record<string, string> = {
  bad_tone: "语气不好",
  good_tone: "语气舒服",
  helpful: "有帮助",
  other: "其他",
  remembered_context: "记得上下文",
  too_cold: "太冷淡",
  too_long: "太长",
  too_pushy: "太急/太强势",
  unsafe: "让人不适",
  warm: "温暖",
  wrong_memory: "记忆有误",
};

function getFeedbackSystemInstruction(
  feedbacks: Array<{
    note: string | null;
    rating: "negative" | "positive";
    reason: string | null;
  }>,
): string {
  if (feedbacks.length === 0) {
    return "";
  }

  const lines = feedbacks.map((feedback) => {
    const tag = feedback.rating === "positive" ? "喜欢" : "不喜欢";
    const reasonLabel =
      feedback.reason && FEEDBACK_REASON_LABELS[feedback.reason]
        ? FEEDBACK_REASON_LABELS[feedback.reason]
        : null;
    const note = feedback.note?.trim() || null;
    const detail = [reasonLabel, note].filter(Boolean).join("，");

    return detail ? `- ${tag}：${detail}` : `- ${tag}`;
  });

  return [
    "近期用户对回复的反馈：",
    ...lines,
    "请把正向反馈视为用户偏好的风格，把负向反馈视为需要避免的问题，据此校准本轮语气与做法。",
    "不要在回复中提到评分、点赞、点踩或反馈记录，保持自然对话。",
  ].join("\n");
}

function buildConversationSummary(input: {
  assistantText: string;
  previousSummary: string | null;
  recentMessages: Array<{ content: string; role: "assistant" | "user" }>;
  userText: string;
}) {
  return [
    input.previousSummary ? `既有摘要：${input.previousSummary}` : "",
    ...input.recentMessages
      .slice(-8)
      .map(
        (message) =>
          `${message.role === "user" ? "用户" : "MoodMate"}：${message.content}`,
      ),
    `用户：${input.userText}`,
    `MoodMate：${input.assistantText}`,
  ]
    .filter(Boolean)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-1600);
}

async function requireCompanionConversation(input: {
  bindings: ApiBindings;
  userId: string;
}) {
  const conversation = await getOrCreateCompanionConversation({
    database: input.bindings.DB,
    nowMs: Date.now(),
    userId: input.userId,
  });

  if (!conversation) {
    throw new AppError(
      BizCode.SYSTEM_DATABASE_UNAVAILABLE,
      "无法读取聊天会话，请确认 D1 已完成最新迁移",
      503,
    );
  }

  return conversation;
}

function getOldestMessageCursor(
  messages: Array<{ createdAtMs: number }>,
  requestedLimit: number,
) {
  if (messages.length === 0 || messages.length < requestedLimit) {
    return null;
  }

  return String(messages[0]!.createdAtMs);
}

function extractLatestUserText(messages: CompanionChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.role !== "user") {
      continue;
    }

    const content = extractMessageText(message);
    if (content) {
      return content;
    }
  }

  return "";
}

function extractMessageText(message: CompanionChatMessage): string {
  return message.parts
    .flatMap((part) => {
      const text = part["text"];
      return part.type === "text" && typeof text === "string" ? [text] : [];
    })
    .join("\n")
    .trim();
}

function normalizeStoredMessage(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractCandidateMemories(userText: string) {
  const normalizedUserText = normalizeStoredMessage(userText);

  if (!normalizedUserText || !MEMORY_TRIGGER_PATTERN.test(normalizedUserText)) {
    return [];
  }

  return [
    {
      content: normalizedUserText.slice(0, 500),
      importance: HIGH_IMPORTANCE_MEMORY_PATTERN.test(normalizedUserText)
        ? 5
        : 3,
      type: classifyMemoryType(normalizedUserText),
    },
  ];
}

function classifyMemoryType(text: string) {
  if (/不喜欢|不要|避免|边界|压力|操控|套路/.test(text)) {
    return "边界";
  }

  if (/喜欢|偏好|更希望|倾向|习惯/.test(text)) {
    return "偏好";
  }

  if (/目标|想要|希望|正在/.test(text)) {
    return "关系目标";
  }

  return "对话风格";
}

async function saveCandidateMemories(input: {
  assistantText: string;
  bindings: ApiBindings;
  previousSummary: string | null;
  providerConfig: ChatProviderConfig;
  sourceMessageId: string;
  userId: string;
  userText: string;
}) {
  const existingMemories = await listActiveCompanionMemories({
    database: input.bindings.DB,
    limit: COMPANION_MEMORY_DEDUPLICATION_LIMIT,
    userId: input.userId,
  });
  const analysisMemories = existingMemories.map((memory) => ({
    content: memory.content,
    importance: memory.importance,
    type: memory.type,
  }));

  const candidate = await judgeCompanionMemoryCandidate({
    assistantText: input.assistantText,
    conversationSummary: input.previousSummary,
    existingMemories: analysisMemories,
    providerConfig: input.providerConfig,
    userText: input.userText,
  });

  if (!candidate.shouldExtract) {
    console.info("跳过长期记忆抽取", {
      category: candidate.category,
      confidence: candidate.confidence,
      reason: candidate.reason,
      userId: input.userId,
    });
    return;
  }

  const extracted = await extractCompanionMemoriesWithLangChain({
    candidate,
    existingMemories: analysisMemories,
    providerConfig: input.providerConfig,
    userText: input.userText,
  });

  const candidates = extracted ?? extractCandidateMemories(input.userText);

  if (candidates.length === 0) {
    return;
  }

  const existingContents = new Set(
    existingMemories.map((memory) => memory.content),
  );

  for (const memory of candidates.slice(0, COMPANION_MEMORY_EXTRACTION_LIMIT)) {
    const content = normalizeStoredMessage(memory.content);

    if (!content || existingContents.has(content)) {
      continue;
    }

    await insertCompanionMemory({
      content,
      database: input.bindings.DB,
      importance: memory.importance,
      nowMs: Date.now(),
      sourceMessageId: input.sourceMessageId,
      type: memory.type,
      userId: input.userId,
    });
    existingContents.add(content);
  }
}

async function resolveProviderConfig(
  bindings: ApiBindings,
): Promise<ChatProviderConfig> {
  const active = await resolveActiveLlmProviderConfig(bindings);

  return {
    api: active.api,
    providerName: active.providerName,
    baseURL: normalizeBaseURL(active.baseURL),
    model: active.model,
    apiKey: active.apiKey,
    disableThinking:
      active.providerOptions?.["openai-chat-completions"]?.disableThinking ??
      false,
  };
}

function normalizeBaseURL(value: string): string {
  return value.trim().replace(/\/+$/, "");
}
