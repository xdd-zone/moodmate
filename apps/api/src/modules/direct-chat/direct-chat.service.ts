import type {
  Agent,
  AiCallScenario,
  AiCallSubjectType,
  DirectChatListItem,
  DirectChatMessage,
  SubmitDirectChatMessageFeedbackRequest,
} from "@repo/contracts";
import { BizCode, CompanionMessageFeedbackReasonSchema } from "@repo/contracts";
import { uuidv7 } from "uuidv7";

import {
  streamText,
  toTextByteStream,
  type AiMessage,
  type AiModel,
} from "@/infra/ai";
import {
  findAccessibleAgent,
  findAssistantMessage,
  findDirectChat,
  getOrCreateDirectChat,
  insertDirectMessage,
  listDirectChats,
  listDirectMessages,
  listDirectMessagesWithFeedback,
  upsertFeedback,
} from "./direct-chat.repository";
import { resolveActiveLlmProviderConfig } from "@/modules/llm-config/llm-config.service";
import { createAiCallObserver } from "@/modules/ai-usage";
import {
  getUserAgentById,
  listActiveAgentMemories,
} from "@/modules/agents/agents.repository";
import { AppError } from "@/shared/app-error";
import type { ApiBindings } from "@/shared/hono-env";
import {
  analyzeDirectConversation,
  buildDirectAnalysisGuidance,
} from "./direct-chat.analysis";
import { organizeDirectChatMemories } from "./direct-chat.memory";

function toAgent(
  record: NonNullable<Awaited<ReturnType<typeof findAccessibleAgent>>>,
  userId: string,
): Agent {
  return {
    ...record,
    editable: record.source === "user" && record.ownerUserId === userId,
  };
}
function toItem(
  row: {
    agent: NonNullable<Awaited<ReturnType<typeof findAccessibleAgent>>>;
    conversation: Awaited<
      ReturnType<typeof getOrCreateDirectChat>
    >["conversation"];
  },
  userId: string,
): DirectChatListItem {
  return {
    id: row.conversation.id,
    agent: toAgent(row.agent, userId),
    title: row.conversation.title,
    summary: row.conversation.summary,
    messageCount: row.conversation.messageCount,
    lastMessageAtMs: row.conversation.lastMessageAtMs,
    createdAtMs: row.conversation.createdAtMs,
    updatedAtMs: row.conversation.updatedAtMs,
  };
}
function inaccessible() {
  return new AppError(BizCode.AGENT_UNAVAILABLE, "朋友当前不可用", 409);
}

export async function listDirectChatsForUser(input: {
  bindings: ApiBindings;
  userId: string;
}) {
  const rows = await listDirectChats({
    database: input.bindings.DB,
    userId: input.userId,
  });
  return { items: rows.map((row) => toItem(row, input.userId)) };
}
export async function createDirectChatForUser(input: {
  agentId: string;
  bindings: ApiBindings;
  userId: string;
}) {
  const agent = await getUserAgentById({
    agentId: input.agentId,
    database: input.bindings.DB,
    userId: input.userId,
  });
  if (!agent) throw new AppError(BizCode.AGENT_NOT_FOUND, "朋友不存在", 404);
  if (agent.status !== "active") throw inaccessible();
  const result = await getOrCreateDirectChat({
    agentId: agent.id,
    database: input.bindings.DB,
    nowMs: Date.now(),
    userId: input.userId,
  });
  return {
    conversation: toItem(
      { agent, conversation: result.conversation },
      input.userId,
    ),
    created: result.created,
  };
}
export async function getDirectChatForUser(input: {
  bindings: ApiBindings;
  conversationId: string;
  userId: string;
}) {
  const row = await findDirectChat({
    conversationId: input.conversationId,
    database: input.bindings.DB,
    userId: input.userId,
  });
  if (!row) throw new AppError(BizCode.AUTH_FORBIDDEN, "无权访问该会话", 403);
  return { conversation: toItem(row, input.userId) };
}
export async function getDirectMessagesForUser(input: {
  bindings: ApiBindings;
  conversationId: string;
  cursor?: number;
  userId: string;
}) {
  await getDirectChatForUser(input);
  const rows = await listDirectMessagesWithFeedback({
    conversationId: input.conversationId,
    cursor: input.cursor,
    database: input.bindings.DB,
    limit: 30,
    userId: input.userId,
  });
  const items: DirectChatMessage[] = rows.map(({ feedback, message }) => {
    const reason = CompanionMessageFeedbackReasonSchema.safeParse(
      feedback?.reason,
    );
    return {
      content: message.content,
      conversationId: message.conversationId,
      createdAtMs: message.createdAtMs,
      feedback: feedback
        ? {
            note: feedback.note,
            rating: feedback.rating,
            reason: reason.success ? reason.data : null,
            updatedAtMs: feedback.updatedAtMs,
          }
        : null,
      id: message.id,
      role: message.role,
      status: message.status,
      turnId: message.turnId,
    };
  });
  return {
    items,
    nextCursor:
      rows.length === 30 ? String(rows[0]?.message.createdAtMs ?? "") : null,
  };
}
function messageText(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

export async function streamDirectChatForUser(input: {
  bindings: ApiBindings;
  conversationId: string;
  messages: Array<{
    role: "user" | "assistant";
    parts: Array<{ type: string; text?: string }>;
  }>;
  requestId: string;
  signal: AbortSignal;
  userId: string;
}) {
  const row = await findDirectChat({
    conversationId: input.conversationId,
    database: input.bindings.DB,
    userId: input.userId,
  });
  if (!row) throw new AppError(BizCode.AUTH_FORBIDDEN, "无权访问该会话", 403);
  if (row.agent.status !== "active") throw inaccessible();
  const latest = [...input.messages]
    .reverse()
    .find((message) => message.role === "user");
  const userText = latest ? messageText(latest.parts) : "";
  if (!userText)
    throw new AppError(BizCode.COMMON_INVALID_REQUEST, "消息不能为空", 400);
  const turnId = uuidv7();
  const userMessage = await insertDirectMessage({
    conversationId: input.conversationId,
    content: userText,
    database: input.bindings.DB,
    nowMs: Date.now(),
    role: "user",
    status: "completed",
    turnId,
  });
  const config = await resolveActiveLlmProviderConfig(input.bindings);
  const model = config as AiModel;
  const recentMessages = await listDirectMessages({
    conversationId: input.conversationId,
    database: input.bindings.DB,
    limit: 20,
  });
  const history = recentMessages.map(
    (message): AiMessage => ({ role: message.role, content: message.content }),
  );

  function observe(scenario: AiCallScenario, subjectType: AiCallSubjectType) {
    return createAiCallObserver({
      ...(subjectType === "agent"
        ? {
            agent: {
              id: row.agent.id,
              name: row.agent.name,
              source: row.agent.source,
            },
          }
        : {}),
      bindings: input.bindings,
      conversationId: row.conversation.id,
      conversationType: "direct",
      initiatorId: input.userId,
      initiatorType: "web_user",
      llmConfigId: config.id,
      model,
      requestId: input.requestId,
      scenario,
      subjectType,
      userId: input.userId,
    });
  }

  const analysis = await analyzeDirectConversation({
    messageCount: row.conversation.messageCount + 1,
    model,
    observers: {
      emotion: observe("direct_emotion_analysis", "system"),
      intent: observe("direct_intent_analysis", "system"),
      relationship: observe("direct_relationship_analysis", "system"),
      safety: observe("direct_safety_analysis", "system"),
    },
    recentMessages,
    signal: input.signal,
    userText,
  });
  const memories = await listActiveAgentMemories({
    agentId: row.agent.id,
    database: input.bindings.DB,
    limit: 12,
    userId: input.userId,
  });
  const memoryText = memories
    .map(
      (memory) =>
        `- [${memory.type}，重要度 ${memory.importance}] ${memory.content}`,
    )
    .join("\n");
  const system = [
    `你是 ${row.agent.name}，${row.agent.headline ?? "一个可靠的虚拟朋友"}。`,
    row.agent.personaPrompt ?? "请用自然、尊重、简洁的中文回应。",
    row.agent.tonePrompt,
    row.agent.guardrailsPrompt,
    row.agent.defaultPrompt,
    buildDirectAnalysisGuidance(analysis),
    memoryText ? `你对这位用户的已有记忆：\n${memoryText}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n");
  const stream = streamText({
    messages: [{ role: "system", content: system }, ...history],
    model,
    signal: input.signal,
    observer: observe("direct_reply", "agent"),
  });
  return toTextByteStream(stream, {
    onComplete: async (text) => {
      await insertDirectMessage({
        conversationId: input.conversationId,
        content: text,
        database: input.bindings.DB,
        nowMs: Date.now(),
        role: "assistant",
        status: "completed",
        turnId,
      });

      if (analysis.safety.allowMemoryExtraction) {
        await organizeDirectChatMemories({
          agentId: row.agent.id,
          assistantText: text,
          database: input.bindings.DB,
          extractionObserver: observe("direct_memory_extraction", "agent"),
          judgementObserver: observe("direct_memory_judgement", "agent"),
          model,
          signal: input.signal,
          sourceMessageId: userMessage.id,
          userId: input.userId,
          userText,
        });
      }
    },
  });
}
export async function submitDirectChatFeedback(input: {
  bindings: ApiBindings;
  conversationId: string;
  messageId: string;
  payload: SubmitDirectChatMessageFeedbackRequest;
  userId: string;
}) {
  await getDirectChatForUser(input);
  const message = await findAssistantMessage({
    conversationId: input.conversationId,
    database: input.bindings.DB,
    messageId: input.messageId,
  });
  if (!message)
    throw new AppError(BizCode.COMMON_NOT_FOUND, "可反馈的回复不存在", 404);
  const feedback = await upsertFeedback({
    conversationId: input.conversationId,
    database: input.bindings.DB,
    messageId: input.messageId,
    note: input.payload.note ?? null,
    rating: input.payload.rating,
    reason: input.payload.reason ?? null,
    turnId: message.turnId,
    userId: input.userId,
    nowMs: Date.now(),
  });
  const reason = CompanionMessageFeedbackReasonSchema.safeParse(
    feedback.reason,
  );
  return {
    feedback: {
      rating: feedback.rating,
      reason: reason.success ? reason.data : null,
      note: feedback.note,
      updatedAtMs: feedback.updatedAtMs,
    },
  };
}
