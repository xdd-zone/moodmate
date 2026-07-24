import {
  BizCode,
  type CompanionChatLlmConfig,
  type CompanionChatMessage,
  type CompanionMemory,
  type ConversationEmotion,
  type ConversationIntent,
  type ConversationSafety,
  type EmotionRoute,
  type ReplyPolicy,
  type UpdateCompanionMemoryRequest,
} from "@repo/contracts";
import { uuidv7 } from "uuidv7";

import { resolveActiveLlmProviderConfig } from "@/modules/llm-config/llm-config.service";
import { AppError } from "@/shared/app-error";
import type { ApiBindings } from "@/shared/hono-env";

import {
  analyzeConversationSafety,
  analyzeConversationUnderstanding,
  buildBoundaryResponse,
  getEmotionRouteSystemInstruction,
  getIntentSystemInstruction,
  getReplyPolicySystemInstruction,
  getSafetySystemInstruction,
  buildConversationAnalysisMetadata,
  evaluateReplyQuality,
  toAssistantReplyQualityMetadata,
} from "./chat.analysis";
import {
  getCompanionProfile,
  getOrCreateCompanionConversation,
  insertCompanionConversationMessage,
  insertCompanionMemory,
  listActiveCompanionMemories,
  listCompanionConversationMessages,
  listCompanionMemories,
  updateCompanionMemory as updateStoredCompanionMemory,
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
  const messages = await listCompanionConversationMessages({
    conversationId: conversation.id,
    database: input.bindings.DB,
    limit: COMPANION_INITIAL_HISTORY_LIMIT,
    userId: input.userId,
  });

  return {
    conversationId: conversation.id,
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

  const [recentMessages, activeMemories, profile] = await Promise.all([
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
        providerConfig,
        recentMessages: analysisRecentMessages,
        safety,
        signal: input.signal,
        userText: latestUserText,
      });

  const intent = understanding?.intent ?? null;
  const emotion = understanding?.emotion ?? null;
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
        intent,
        memories: activeMemories,
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
      bindings: input.bindings,
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
  intent: ConversationIntent | null;
  memories: Array<{ content: string; importance: number; type: string }>;
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
    getReplyPolicySystemInstruction(input.replyPolicy),
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
  bindings: ApiBindings;
  sourceMessageId: string;
  userId: string;
  userText: string;
}) {
  const candidates = extractCandidateMemories(input.userText);

  if (candidates.length === 0) {
    return;
  }

  const existingMemories = await listActiveCompanionMemories({
    database: input.bindings.DB,
    limit: COMPANION_MEMORY_DEDUPLICATION_LIMIT,
    userId: input.userId,
  });
  const existingContents = new Set(
    existingMemories.map((memory) => memory.content),
  );

  for (const memory of candidates.slice(0, COMPANION_MEMORY_EXTRACTION_LIMIT)) {
    if (existingContents.has(memory.content)) {
      continue;
    }

    await insertCompanionMemory({
      content: memory.content,
      database: input.bindings.DB,
      importance: memory.importance,
      nowMs: Date.now(),
      sourceMessageId: input.sourceMessageId,
      type: memory.type,
      userId: input.userId,
    });
    existingContents.add(memory.content);
  }
}

async function resolveProviderConfig(
  bindings: ApiBindings,
): Promise<ChatProviderConfig> {
  const active = await resolveActiveLlmProviderConfig(bindings);

  return {
    providerName: active.providerName,
    baseURL: normalizeBaseURL(active.baseURL),
    model: active.model,
    apiKey: active.apiKey,
    disableThinking: active.disableThinking,
  };
}

function normalizeBaseURL(value: string): string {
  return value.trim().replace(/\/+$/, "");
}
