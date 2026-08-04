import {
  ConversationEmotionSchema,
  ConversationIntentSchema,
  ConversationRelationshipStageSchema,
  ConversationSafetySchema,
  type ConversationEmotion,
  type ConversationIntent,
  type ConversationRelationshipStage,
  type ConversationSafety,
} from "@repo/contracts";
import type { z } from "zod";

import { type AiCallObserver, type AiMessage, type AiModel } from "@/infra/ai";
import { generateStructuredJson } from "./direct-chat.structured";

const fallbackSafety: ConversationSafety = {
  allowMemoryExtraction: false,
  boundaryAction: "soft_boundary",
  category: "other",
  reason: "安全判断暂时不可用",
  responseGuidance: "保持克制和尊重，不提供高风险建议，不虚构现实行动能力。",
  safetyLevel: "caution",
};

const fallbackIntent: ConversationIntent = {
  clarifyingQuestion: null,
  confidence: 0,
  primary: "unclear",
  promptGuidance: "先回应用户明确表达的内容，不确定时只问一个简短问题。",
  relationshipSignal: "neutral",
  replyExpectation: {
    depth: "medium",
    directness: "balanced",
    shouldAskQuestion: false,
    warmth: "medium",
  },
  requestedAgentAction: "continue_topic",
  secondary: [],
  shouldClarify: false,
  userNeed: "unknown",
};

const fallbackEmotion: ConversationEmotion = {
  arousal: "medium",
  emotionalCue: "没有可靠的情绪判断",
  intensity: 0,
  needsClarification: false,
  needsComfort: false,
  needsDeescalation: false,
  primaryEmotion: "neutral",
  replyTone: "warm",
  secondaryEmotions: [],
  valence: "neutral",
};

const fallbackRelationship: ConversationRelationshipStage = {
  boundaryMode: "careful",
  closenessScore: 0,
  displayName: "初识",
  intimacyPermission: "low",
  pacing: "hold",
  relationshipGuidance: "保持自然、友好和有分寸的交流。",
  riskSignals: ["low_history"],
  stability: "new",
  stage: "new_connection",
  trustLevel: "low",
};

interface DirectAnalysisObservers {
  emotion: AiCallObserver;
  intent: AiCallObserver;
  relationship: AiCallObserver;
  safety: AiCallObserver;
}

export interface DirectConversationAnalysis {
  emotion: ConversationEmotion;
  intent: ConversationIntent;
  relationship: ConversationRelationshipStage;
  safety: ConversationSafety;
}

async function generateWithFallback<T>(input: {
  fallback: T;
  label: string;
  maxTokens: number;
  messages: AiMessage[];
  model: AiModel;
  observer: AiCallObserver;
  schema: z.ZodType<T>;
  schemaName: string;
  signal: AbortSignal;
}): Promise<T> {
  try {
    return await generateStructuredJson({
      maxTokens: input.maxTokens,
      messages: input.messages,
      model: input.model,
      observer: input.observer,
      schema: input.schema,
      schemaName: input.schemaName,
      signal: input.signal,
    });
  } catch (error) {
    console.warn("单聊分析失败，使用默认判断", {
      analysis: input.label,
      error: error instanceof Error ? error.message : String(error),
    });
    return input.fallback;
  }
}

export async function analyzeDirectConversation(input: {
  messageCount: number;
  model: AiModel;
  observers: DirectAnalysisObservers;
  recentMessages: Array<{ content: string; role: "user" | "assistant" }>;
  signal: AbortSignal;
  userText: string;
}): Promise<DirectConversationAnalysis> {
  const recentContext = input.recentMessages
    .slice(-8)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  const [safety, intent, emotion, relationship] = await Promise.all([
    generateWithFallback({
      fallback: fallbackSafety,
      label: "safety",
      maxTokens: 500,
      messages: [
        {
          role: "system",
          content:
            "判断用户消息的安全边界。只分析风险、应采取的边界动作，以及是否允许从这条消息整理长期记忆。",
        },
        { role: "user", content: input.userText },
      ],
      model: input.model,
      observer: input.observers.safety,
      schema: ConversationSafetySchema,
      schemaName: "direct_conversation_safety",
      signal: input.signal,
    }),
    generateWithFallback({
      fallback: fallbackIntent,
      label: "intent",
      maxTokens: 700,
      messages: [
        {
          role: "system",
          content:
            "判断用户当前的交流意图、需要和期待的回复方式。不要回答用户，只返回结构化判断。",
        },
        { role: "user", content: input.userText },
      ],
      model: input.model,
      observer: input.observers.intent,
      schema: ConversationIntentSchema,
      schemaName: "direct_conversation_intent",
      signal: input.signal,
    }),
    generateWithFallback({
      fallback: fallbackEmotion,
      label: "emotion",
      maxTokens: 500,
      messages: [
        {
          role: "system",
          content:
            "判断用户当前情绪、强度和回复语气。不要诊断，不要回答用户，只返回结构化判断。",
        },
        { role: "user", content: input.userText },
      ],
      model: input.model,
      observer: input.observers.emotion,
      schema: ConversationEmotionSchema,
      schemaName: "direct_conversation_emotion",
      signal: input.signal,
    }),
    generateWithFallback({
      fallback: fallbackRelationship,
      label: "relationship",
      maxTokens: 700,
      messages: [
        {
          role: "system",
          content:
            "根据会话量和最近对话判断关系阶段、边界和推进节奏。不要回答用户，只返回结构化判断。",
        },
        {
          role: "user",
          content: `会话消息数：${input.messageCount}\n最近对话：\n${recentContext || "暂无"}`,
        },
      ],
      model: input.model,
      observer: input.observers.relationship,
      schema: ConversationRelationshipStageSchema,
      schemaName: "direct_conversation_relationship",
      signal: input.signal,
    }),
  ]);

  return { emotion, intent, relationship, safety };
}

export function buildDirectAnalysisGuidance(
  analysis: DirectConversationAnalysis,
): string {
  return [
    `安全边界：${analysis.safety.responseGuidance}`,
    `用户意图：${analysis.intent.promptGuidance}`,
    `情绪线索：${analysis.emotion.emotionalCue}；回复语气使用 ${analysis.emotion.replyTone}`,
    `关系阶段：${analysis.relationship.displayName}；${analysis.relationship.relationshipGuidance}`,
  ].join("\n");
}
