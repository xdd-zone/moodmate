import { z } from "zod";

import type { UserAgentRecord } from "@/modules/agents/agents.schema";

import type {
  GroupChatMemberWithAgentRow,
  GroupChatMessageWithAgentRow,
} from "./group-chat.repository";

/**
 * 群聊专用的用户情绪结构。字段为发言权决策定制：
 * needsAdvice / socialEnergy 直接映射到打分规则，与单聊 ConversationEmotion 不共享。
 */
export const GroupChatUserEmotionSchema = z.object({
  primaryEmotion: z.enum([
    "neutral",
    "happy",
    "sad",
    "anxious",
    "angry",
    "lonely",
    "stressed",
    "confused",
    "romantic",
    "playful",
    "unknown",
  ]),
  intensity: z.number().min(0).max(1),
  needsComfort: z.boolean(),
  needsAdvice: z.boolean(),
  needsDeescalation: z.boolean(),
  socialEnergy: z.enum(["low", "medium", "high"]),
  reason: z.string().trim().max(400),
});

export type GroupChatUserEmotion = z.infer<typeof GroupChatUserEmotionSchema>;

export type RelationshipStage =
  | "new_connection"
  | "warming_up"
  | "trusted"
  | "close_bond";

export interface AgentSpeakingContext {
  agentId: string;
  conversationMessageCount: number;
  recentReplyCount: number;
  lastSpokeTurnsAgo: number | null;
  relationshipStage: RelationshipStage;
  relationshipScore: number;
  freshnessScore: number;
}

export interface GroupSpeakingContext {
  userEmotion: GroupChatUserEmotion;
  agentContexts: AgentSpeakingContext[];
}

/** 情绪 LLM 失败时的关键词兜底：只判断主情绪与陪伴需求，够发言权打分用。 */
export function buildFallbackGroupUserEmotion(
  userText: string,
): GroupChatUserEmotion {
  const text = userText;
  const lower = userText.toLowerCase();

  const sad = /(难过|伤心|委屈|想哭|失落|崩溃|没人懂|孤独|孤单)/.test(text);
  const anxious = /(焦虑|紧张|慌|害怕|担心|压力|睡不着|不安)/.test(text);
  const angry = /(生气|愤怒|烦死|气死|吵架|不爽|火大)/.test(text);
  const romantic = /(喜欢|想你|暧昧|心动|恋爱|约会|亲密|撒娇)/.test(text);
  const playful = /(哈哈|笑死|好玩|逗|开玩笑|hh|lol)/i.test(lower);
  const happy = /(开心|高兴|快乐|惊喜|太好了|舒服了)/.test(text);
  const confused = /(怎么办|不知道|纠结|迷茫|怎么选|不懂|为什么)/.test(text);

  let primaryEmotion: GroupChatUserEmotion["primaryEmotion"] = "neutral";
  if (sad) {
    primaryEmotion = /(孤独|孤单|没人懂)/.test(text) ? "lonely" : "sad";
  } else if (angry) {
    primaryEmotion = "angry";
  } else if (anxious) {
    primaryEmotion = /(压力|睡不着)/.test(text) ? "stressed" : "anxious";
  } else if (confused) {
    primaryEmotion = "confused";
  } else if (romantic) {
    primaryEmotion = "romantic";
  } else if (playful) {
    primaryEmotion = "playful";
  } else if (happy) {
    primaryEmotion = "happy";
  }

  const needsComfort =
    sad || anxious || angry || /陪陪|安慰|抱抱|难受/.test(text);
  const needsAdvice =
    confused || /(建议|分析|复盘|怎么做|帮我想|选择)/.test(text);
  const needsDeescalation = angry || /(冷静|别吵|缓一缓|降温)/.test(text);

  const socialEnergy: GroupChatUserEmotion["socialEnergy"] = playful
    ? "high"
    : sad || anxious || angry
      ? "low"
      : "medium";

  return GroupChatUserEmotionSchema.parse({
    primaryEmotion,
    intensity: needsComfort || needsDeescalation ? 0.6 : 0.3,
    needsComfort,
    needsAdvice,
    needsDeescalation,
    socialEnergy,
    reason: "关键词兜底：LLM 情绪识别不可用，按关键词推导。",
  });
}

/** 关系阶段先用一对一消息数做启发式推导，非完整关系阶段模型。 */
export function getRelationshipStageFromMessageCount(
  messageCount: number,
): RelationshipStage {
  if (messageCount >= 80) {
    return "close_bond";
  }

  if (messageCount >= 30) {
    return "trusted";
  }

  if (messageCount >= 8) {
    return "warming_up";
  }

  return "new_connection";
}

export function getRelationshipScore(stage: RelationshipStage): number {
  if (stage === "close_bond") {
    return 0.95;
  }

  if (stage === "trusted") {
    return 0.78;
  }

  if (stage === "warming_up") {
    return 0.52;
  }

  return 0.25;
}

/** 保留两位小数，避免打分抖动引入浮点尾数。 */
function round2(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * 汇总发言权上下文：用户情绪 + 每个 Agent 的关系阶段与最近发言新鲜度。
 * 纯函数、无 LLM、无 DB。userEmotion 缺省时用关键词兜底。
 */
export function buildGroupSpeakingContext(input: {
  agents: GroupChatMemberWithAgentRow[];
  recentMessages: GroupChatMessageWithAgentRow[];
  userText: string;
  userEmotion?: GroupChatUserEmotion | null;
}): GroupSpeakingContext {
  const recentAgentMessages = input.recentMessages
    .filter((message) => message.senderType === "agent" && message.agentId)
    .slice(-18);

  const maxTurnIndex = recentAgentMessages.reduce(
    (max, message) => Math.max(max, message.turnIndex),
    0,
  );

  const agentContexts: AgentSpeakingContext[] = input.agents.map((agent) => {
    const messagesByAgent = recentAgentMessages.filter(
      (message) => message.agentId === agent.agentId,
    );
    const lastMessage = messagesByAgent.at(-1);
    const lastSpokeTurnsAgo = lastMessage
      ? Math.max(0, maxTurnIndex - lastMessage.turnIndex)
      : null;
    const freshnessBase =
      lastSpokeTurnsAgo === null ? 1 : Math.min(1, lastSpokeTurnsAgo / 6);
    const freshnessPenalty = Math.min(0.75, messagesByAgent.length * 0.16);
    const freshnessScore = Math.max(
      0,
      round2(freshnessBase - freshnessPenalty),
    );

    const relationshipStage = getRelationshipStageFromMessageCount(
      agent.conversationMessageCount,
    );

    return {
      agentId: agent.agentId,
      conversationMessageCount: agent.conversationMessageCount,
      recentReplyCount: messagesByAgent.length,
      lastSpokeTurnsAgo,
      relationshipStage,
      relationshipScore: getRelationshipScore(relationshipStage),
      freshnessScore,
    };
  });

  return {
    userEmotion:
      input.userEmotion ?? buildFallbackGroupUserEmotion(input.userText),
    agentContexts,
  };
}

/** 把人设各段拼成一段可做关键词匹配的文本。 */
function buildProfileText(agent: UserAgentRecord | undefined): string {
  if (!agent) {
    return "";
  }

  return [
    agent.headline,
    agent.description,
    agent.storyBackground,
    agent.personaPrompt,
    agent.tonePrompt,
    agent.guardrailsPrompt,
    agent.defaultPrompt,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("\n");
}

/**
 * 非点名场景的本地打分：关系熟悉度 + 发言新鲜度 - 最近发言频率，
 * 再按用户情绪匹配人设关键词加分。LLM 不可用时比纯关键词更稳的底座。
 */
export function scoreAgentForFallbackSelection(params: {
  agent: GroupChatMemberWithAgentRow;
  userEmotion: GroupChatUserEmotion;
  context: AgentSpeakingContext | undefined;
  agentRecord: UserAgentRecord | undefined;
}): number {
  let score = 0;

  if (params.context) {
    score += params.context.relationshipScore * 1.6;
    score += params.context.freshnessScore * 1.8;
    score -= params.context.recentReplyCount * 0.45;

    if (params.context.lastSpokeTurnsAgo === 0) {
      score -= 0.9;
    }
  }

  const profileText = buildProfileText(params.agentRecord);

  if (
    params.userEmotion.needsComfort &&
    /(温柔|陪伴|情绪|安慰|稳定|倾听|治愈|共情)/.test(profileText)
  ) {
    score += 2.4;
  }

  if (
    params.userEmotion.needsAdvice &&
    /(理性|分析|建议|计划|复盘|清醒|判断|策略)/.test(profileText)
  ) {
    score += 2.1;
  }

  if (
    params.userEmotion.needsDeescalation &&
    /(克制|边界|冷静|稳定|成熟|安全)/.test(profileText)
  ) {
    score += 2.2;
  }

  return score;
}

/** 把发言权上下文格式化成选择器 prompt 用的多行文本。 */
export function formatSpeakingContextForPrompt(input: {
  speakingContext: GroupSpeakingContext;
  agents: GroupChatMemberWithAgentRow[];
}): string {
  const { userEmotion, agentContexts } = input.speakingContext;
  const nameByAgentId = new Map(
    input.agents.map((agent) => [agent.agentId, agent.name]),
  );
  const contextByAgentId = new Map(
    agentContexts.map((context) => [context.agentId, context]),
  );

  const emotionLine = [
    `用户主情绪：${userEmotion.primaryEmotion}`,
    `强度：${userEmotion.intensity.toFixed(2)}`,
    `需要安慰：${userEmotion.needsComfort ? "是" : "否"}`,
    `需要建议：${userEmotion.needsAdvice ? "是" : "否"}`,
    `需要降温：${userEmotion.needsDeescalation ? "是" : "否"}`,
    `社交能量：${userEmotion.socialEnergy}`,
  ].join("，");

  const agentLines = input.agents.map((agent) => {
    const context = contextByAgentId.get(agent.agentId);
    const name = nameByAgentId.get(agent.agentId) ?? agent.name;

    if (!context) {
      return `- ${name}（id: ${agent.agentId}）：暂无发言权数据`;
    }

    return [
      `- ${name}（id: ${agent.agentId}）：`,
      `关系阶段 ${context.relationshipStage}`,
      `一对一消息数 ${context.conversationMessageCount}`,
      `最近发言 ${context.recentReplyCount} 次`,
      `距上次发言 ${
        context.lastSpokeTurnsAgo === null
          ? "从未"
          : `${context.lastSpokeTurnsAgo} 轮`
      }`,
      `新鲜度 ${context.freshnessScore.toFixed(2)}`,
    ].join("，");
  });

  return [emotionLine, "", ...agentLines].join("\n");
}
