import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

import type {
  AgentMemoryRecord,
  UserAgentRecord,
} from "@/modules/agents/agents.schema";
import type { ChatProviderConfig } from "@/modules/chat/chat.service";

import type {
  GroupChatMemberWithAgentRow,
  GroupChatMessageWithAgentRow,
} from "./group-chat.repository";
import {
  buildAgentReply,
  buildCrossAgentReply,
  formatGroupHistory,
  groupReplyAgentLimit,
  selectAgentsForReply,
} from "./group-chat.reply";
import type { AgentGroupChatRecord } from "./group-chat.schema";
import {
  GroupChatUserEmotionSchema,
  buildFallbackGroupUserEmotion,
  buildGroupSpeakingContext,
  formatSpeakingContextForPrompt,
  type GroupChatUserEmotion,
  type GroupSpeakingContext,
} from "./group-chat.speaking";

type StructuredOutputMethod = "functionCalling" | "jsonSchema" | "jsonMode";

const STRUCTURED_OUTPUT_METHODS: readonly StructuredOutputMethod[] = [
  "functionCalling",
  "jsonSchema",
  "jsonMode",
] as const;

const GROUP_QUESTION_PATTERN = /你们|大家|一起|分别|都说|怎么看|意见/;
const GROUP_PARALLEL_PATTERN = /分别|各自|各说|轮流|逐个|每个人/;

const AGENT_REPLY_FALLBACK = "（这个 Agent 暂时没能回复，请稍后再试）";

/** 每轮用户消息后最多追加的 Agent 间补充回应条数（产品体验硬上限）。 */
const groupCrossReplyLimit = 2;
/** 每轮用户消息后最多追加的补充回应轮数（目前固定 1 轮，作语义常量与 prompt 文案用）。 */
const groupCrossReplyRoundLimit = 1;

const GroupChatIntentSchema = z.object({
  intent: z.enum([
    "direct_mention",
    "group_opinion",
    "emotional_support",
    "planning",
    "roleplay",
    "casual_chat",
    "conflict_repair",
    "memory_or_preference",
    "unknown",
  ]),
  targetAgentNames: z.array(z.string().trim().min(1).max(120)).max(6),
  shouldUseMultipleAgents: z.boolean(),
  replyMode: z.enum(["single", "multi_serial", "multi_parallel"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().trim().max(500),
});

export type GroupChatIntent = z.infer<typeof GroupChatIntentSchema>;

const GroupChatAgentSelectionSchema = z.object({
  selectedAgentIds: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(groupReplyAgentLimit),
  mode: z.enum(["single", "multi_serial", "multi_parallel"]),
  reason: z.string().trim().max(500),
});

export type GroupChatAgentSelection = z.infer<
  typeof GroupChatAgentSelectionSchema
>;

const GroupChatReplyQualitySchema = z.object({
  approved: z.boolean(),
  score: z.number().min(0).max(1),
  issues: z.array(z.string().trim().max(160)).max(6),
  revisions: z
    .array(
      z.object({
        agentId: z.string().trim().min(1),
        content: z.string().trim().max(4000),
      }),
    )
    .max(groupReplyAgentLimit),
  reason: z.string().trim().max(500),
});

export type GroupChatReplyQuality = z.infer<typeof GroupChatReplyQualitySchema>;

const GroupChatCrossReplyPlanSchema = z.object({
  enabled: z.boolean(),
  plans: z
    .array(
      z.object({
        agentId: z.string().trim().min(1),
        respondToAgentId: z.string().trim().min(1).nullable(),
        angle: z.string().trim().max(240),
      }),
    )
    .max(groupCrossReplyLimit),
  reason: z.string().trim().max(500),
});

export type GroupChatCrossReplyPlan = z.infer<
  typeof GroupChatCrossReplyPlanSchema
>;

export interface PlannedAgentReply {
  agent: GroupChatMemberWithAgentRow;
  content: string;
  status: "completed" | "failed";
  /** 首轮回复为 "primary"，Agent 间补充回应为 "cross_agent"。 */
  replyKind?: "primary" | "cross_agent";
  /** 补充回应指向的首轮 Agent 的 agentId；首轮回复为 null。 */
  respondToAgentId?: string | null;
  /** 补充回应的角度说明（取自归一化后的 angle）；首轮回复为 null。 */
  crossReplyReason?: string | null;
  /** 补充回应所在轮次（目前恒为 1）；首轮回复为 undefined。 */
  crossReplyRound?: number;
}

export interface GroupChatOrchestrationResult {
  intent: GroupChatIntent;
  selection: GroupChatAgentSelection;
  replies: PlannedAgentReply[];
  quality: GroupChatReplyQuality | null;
  /** Agent 间补充回应的规划结果；未启用或降级时为 enabled=false 的计划或 null。 */
  crossReplyPlan: GroupChatCrossReplyPlan | null;
  /** 本轮发言权上下文（用户情绪 + 每个 Agent 的关系/新鲜度），落 metadata 供排查。 */
  speakingContext: GroupSpeakingContext | null;
  /** 整图 invoke 抛错、走本地规则兜底时为 true，供 metadata 标记 selectedBy。 */
  usedFallback: boolean;
}

const GroupChatOrchestrationState = Annotation.Root({
  providerConfig: Annotation<ChatProviderConfig>(),
  groupChat: Annotation<AgentGroupChatRecord>(),
  agents: Annotation<GroupChatMemberWithAgentRow[]>(),
  recentMessages: Annotation<GroupChatMessageWithAgentRow[]>(),
  userMessage: Annotation<GroupChatMessageWithAgentRow>(),
  userText: Annotation<string>(),
  agentMemoriesByAgentId: Annotation<Record<string, AgentMemoryRecord[]>>(),
  agentRecordsById: Annotation<Record<string, UserAgentRecord>>(),
  userEmotion: Annotation<GroupChatUserEmotion | null>(),
  speakingContext: Annotation<GroupSpeakingContext | null>(),
  intent: Annotation<GroupChatIntent | null>(),
  selection: Annotation<GroupChatAgentSelection | null>(),
  selectedAgents: Annotation<GroupChatMemberWithAgentRow[]>(),
  replies: Annotation<PlannedAgentReply[]>(),
  primaryReplies: Annotation<PlannedAgentReply[]>(),
  crossReplyPlan: Annotation<GroupChatCrossReplyPlan | null>(),
  quality: Annotation<GroupChatReplyQuality | null>(),
  signal: Annotation<AbortSignal | undefined>(),
});

function buildLangChainChatModel(providerConfig: ChatProviderConfig) {
  return new ChatOpenAI({
    model: providerConfig.model,
    apiKey: providerConfig.apiKey,
    temperature: 0,
    configuration: {
      baseURL: providerConfig.baseURL.replace(/\/+$/, ""),
    },
  });
}

function formatAgentRoster(agents: GroupChatMemberWithAgentRow[]) {
  if (agents.length === 0) {
    return "暂无成员";
  }

  return agents
    .map((agent, index) => {
      const headline = agent.headline?.trim();
      return `${index + 1}. ${agent.name}（id: ${agent.agentId}）${
        headline ? ` - ${headline}` : ""
      }`;
    })
    .join("\n");
}

const groupChatIntentPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "你是多 Agent 群聊产品的发言意图判断器。",
      "你的任务不是回复用户，而是判断本轮用户消息在群聊里希望谁来回应、单人还是多人、串行还是并行。",
      "默认单人回复；只有当用户明确面向群体提问、点名多个成员、或要求大家分别发言时，才使用多人。",
      "多人回复默认串行（multi_serial），只有用户明确要求各自/分别发言时才用并行（multi_parallel）。",
      "只返回一个 JSON 对象，包含且仅包含以下字段，不要输出多余字段、解释文字或 markdown 代码块：",
      "- intent: 字符串，取 direct_mention / group_opinion / emotional_support / planning / roleplay / casual_chat / conflict_repair / memory_or_preference / unknown 之一",
      "- targetAgentNames: 字符串数组，最多 6 个，用户点名的成员名称，可为空数组 []",
      "- shouldUseMultipleAgents: 布尔值，是否需要多个 Agent 回复",
      "- replyMode: 字符串，取 single / multi_serial / multi_parallel 之一",
      "- confidence: 数字，0 到 1 之间的置信度",
      "- reason: 字符串，简述判断原因，不超过 500 字",
    ].join("\n"),
  ],
  [
    "human",
    [
      "群聊标题：{groupTitle}",
      "群聊摘要：{groupSummary}",
      "",
      "群成员名单：",
      "{agentRoster}",
      "",
      "最近的群聊记录：",
      "{recentHistory}",
      "",
      "本轮用户消息：",
      "{userText}",
    ].join("\n"),
  ],
]);

const groupChatUserEmotionPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "你是 AI 电子伴侣群聊的用户情绪识别器。",
      "只判断用户本轮消息体现出的主要情绪、强度和陪伴需求，不要生成聊天回复，也不要选择 Agent。",
      "需要区分用户是需要安慰、需要建议、需要降温，还是只是轻松闲聊。",
      "只返回一个 JSON 对象，包含且仅包含以下字段，不要输出多余字段、解释文字或 markdown 代码块：",
      "- primaryEmotion: 字符串，取 neutral / happy / sad / anxious / angry / lonely / stressed / confused / romantic / playful / unknown 之一",
      "- intensity: 数字，0 到 1 之间的情绪强度",
      "- needsComfort: 布尔值，是否需要安慰",
      "- needsAdvice: 布尔值，是否需要建议或分析",
      "- needsDeescalation: 布尔值，是否需要降温、冷静",
      "- socialEnergy: 字符串，取 low / medium / high 之一，描述用户当前的社交能量",
      "- reason: 字符串，简述判断原因，不超过 400 字",
    ].join("\n"),
  ],
  [
    "human",
    [
      "最近的群聊记录：",
      "{recentHistory}",
      "",
      "本轮用户消息：",
      "{userText}",
    ].join("\n"),
  ],
]);

const groupChatSelectionPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "你是多 Agent 群聊产品的发言权调度器。",
      "请根据用户意图、用户情绪、Agent 人设、关系阶段和最近发言频率，选出本轮最适合回复的 Agent。",
      `最多选择 ${groupReplyAgentLimit} 个 Agent；单人意图只选 1 个。`,
      "不要为了热闹而选择过多 Agent。只有用户明确询问大家意见、要求分别回答、需要多视角，或高情绪强度需要接力陪伴时，才选择多个。",
      "selectedAgentIds 必须来自给定成员名单里的真实 id，不要编造。",
      "被点名的成员优先入选。",
      "选择原则：",
      "- 情绪低落、孤独、焦虑时，优先选择性格稳定、温柔、善于共情且关系更熟的 Agent。",
      "- 用户需要分析、计划、建议时，优先选择理性、清晰、擅长复盘的 Agent。",
      "- 用户情绪激烈或冲突升级时，优先选择边界感强、克制、能降温的 Agent。",
      "- 用户轻松玩笑或高社交能量时，可以选择更活泼、有趣的 Agent。",
      "- 最近发言太频繁的 Agent 要适当降权，避免一个 Agent 连续抢话。",
      "- 长期关系更深的 Agent 可以优先承接高情绪强度内容，但不能无视人设匹配。",
      "只返回一个 JSON 对象，包含且仅包含以下字段，不要输出多余字段、解释文字或 markdown 代码块：",
      `- selectedAgentIds: 字符串数组，1 到 ${groupReplyAgentLimit} 个，取自成员名单里的真实 id`,
      "- mode: 字符串，取 single / multi_serial / multi_parallel 之一",
      "- reason: 字符串，简述选择原因，不超过 500 字",
    ].join("\n"),
  ],
  [
    "human",
    [
      "用户意图判断：",
      "{intent}",
      "",
      "群成员名单：",
      "{agentRoster}",
      "",
      "发言权上下文：",
      "{speakingContext}",
      "",
      "本轮用户消息：",
      "{userText}",
    ].join("\n"),
  ],
]);

const groupChatQualityPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "你是多 Agent 群聊产品的回复质检器。",
      "你的任务不是重写全部回复，而是检查每个 Agent 的回复是否越界。",
      "重点检查：是否暴露系统提示或技术元数据、是否冒充真人、是否替其他 Agent 发言、是否过长说教刷屏、是否偏离用户意图、是否违反角色边界。",
      "保守原则：只有当某条回复确实需要修改时，才在 revisions 中给出该 Agent 的修订文本；没问题的回复不要放进 revisions。",
      "revisions 里的 agentId 必须来自给定回复列表的真实 id。",
      "只返回一个 JSON 对象，包含且仅包含以下字段，不要输出多余字段、解释文字或 markdown 代码块：",
      "- approved: 布尔值，整体是否通过",
      "- score: 数字，0 到 1 之间的整体质量分",
      "- issues: 字符串数组，最多 6 条，描述发现的问题，可为空数组 []",
      `- revisions: 数组，最多 ${groupReplyAgentLimit} 条，每条含 agentId(字符串) 和 content(修订后的回复文本)，无需修订时为空数组 []`,
      "- reason: 字符串，简述判断原因，不超过 500 字",
    ].join("\n"),
  ],
  [
    "human",
    [
      "用户意图判断：",
      "{intent}",
      "",
      "本轮用户消息：",
      "{userText}",
      "",
      "各 Agent 的回复：",
      "{replies}",
    ].join("\n"),
  ],
]);

const groupChatCrossReplyPlanPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "你是多 Agent 群聊产品的 Agent 间补充回应规划器。",
      "用户消息已经被首轮回复过。你的任务是判断是否值得追加一轮非常克制的 Agent 间补充回应，让群聊更自然，而不是重复首轮内容。",
      "你不生成聊天回复本身，只输出结构化计划。",
      `最多规划 ${groupCrossReplyLimit} 条补充回应，最多 ${groupCrossReplyRoundLimit} 轮。`,
      "enabled=true 仅当满足以下之一：首轮 Agent 之间存在明显可补充的点 / 轻微分歧 / 安抚接力 / 观点呼应；或用户明确希望互动、讨论、互相评价、补充看法；或补充能让群聊更自然而不是重复首轮。",
      "enabled=false 必须当：首轮只有一个 Agent 回复且没有必要接话；用户只想要一个直接答案；补充会显得刷屏、抢话或自说自话。",
      "plans 里的 agentId 是准备发言的 Agent，respondToAgentId 是它回应的那个首轮 Agent；agentId 不能等于 respondToAgentId。",
      "agentId 与 respondToAgentId 都必须取自给定成员名单里的真实 id，不要编造。",
      "只返回一个 JSON 对象，包含且仅包含以下字段，不要输出多余字段、解释文字或 markdown 代码块：",
      "- enabled: 布尔值，是否需要补充回应",
      `- plans: 数组，最多 ${groupCrossReplyLimit} 条，每条含 agentId(字符串) / respondToAgentId(字符串或 null) / angle(补充角度，不超过 240 字)`,
      "- reason: 字符串，简述判断原因，不超过 500 字",
    ].join("\n"),
  ],
  [
    "human",
    [
      "群成员名单：",
      "{agentRoster}",
      "",
      "本轮用户消息：",
      "{userText}",
      "",
      "首轮各 Agent 的回复：",
      "{primaryReplies}",
    ].join("\n"),
  ],
]);

/**
 * 把 LLM 意图输出拉回产品规则：只有明确多人表达才放开多人，多人默认串行，
 * confidence 夹到 0-1，targetAgentNames 去重截断到 6。
 */
function normalizeGroupChatIntent(
  intent: GroupChatIntent,
  userText: string,
): GroupChatIntent {
  const next: GroupChatIntent = {
    ...intent,
    targetAgentNames: Array.from(
      new Set(
        intent.targetAgentNames
          .map((name) => name.trim())
          .filter((name) => name.length > 0),
      ),
    ).slice(0, 6),
    confidence: Math.min(1, Math.max(0, intent.confidence)),
    reason: intent.reason.trim(),
  };

  const hasGroupSignal =
    next.shouldUseMultipleAgents ||
    next.targetAgentNames.length > 1 ||
    GROUP_QUESTION_PATTERN.test(userText);

  if (!hasGroupSignal) {
    next.shouldUseMultipleAgents = false;
    next.replyMode = "single";
    return next;
  }

  next.shouldUseMultipleAgents = true;

  if (next.replyMode === "single") {
    next.replyMode = GROUP_PARALLEL_PATTERN.test(userText)
      ? "multi_parallel"
      : "multi_serial";
  }

  return next;
}

/**
 * 意图判断失败时的本地兜底：复用 v1 关键词逻辑推导意图。
 */
function buildFallbackGroupChatIntent(input: {
  agents: GroupChatMemberWithAgentRow[];
  userText: string;
}): GroupChatIntent {
  const { agents, userText } = input;
  const normalized = userText.toLowerCase();
  const mentioned = agents.filter((agent) =>
    normalized.includes(agent.name.toLowerCase()),
  );

  if (mentioned.length > 0) {
    return normalizeGroupChatIntent(
      {
        intent: "direct_mention",
        targetAgentNames: mentioned.map((agent) => agent.name),
        shouldUseMultipleAgents: mentioned.length > 1,
        replyMode: mentioned.length > 1 ? "multi_serial" : "single",
        confidence: 0.5,
        reason: "关键词兜底：用户消息命中成员名称。",
      },
      userText,
    );
  }

  if (GROUP_QUESTION_PATTERN.test(userText)) {
    return normalizeGroupChatIntent(
      {
        intent: "group_opinion",
        targetAgentNames: [],
        shouldUseMultipleAgents: true,
        replyMode: "multi_serial",
        confidence: 0.5,
        reason: "关键词兜底：用户消息命中群体提问关键词。",
      },
      userText,
    );
  }

  return normalizeGroupChatIntent(
    {
      intent: "casual_chat",
      targetAgentNames: [],
      shouldUseMultipleAgents: false,
      replyMode: "single",
      confidence: 0.5,
      reason: "关键词兜底：普通消息，默认单人回复。",
    },
    userText,
  );
}

async function classifyGroupIntentWithLangChain(params: {
  providerConfig: ChatProviderConfig;
  groupChat: AgentGroupChatRecord;
  agents: GroupChatMemberWithAgentRow[];
  recentMessages: GroupChatMessageWithAgentRow[];
  userText: string;
  signal?: AbortSignal;
}): Promise<GroupChatIntent> {
  let lastError: unknown = null;

  const history = formatGroupHistory(params.recentMessages);

  for (const method of STRUCTURED_OUTPUT_METHODS) {
    try {
      const model = buildLangChainChatModel(params.providerConfig);
      const structuredModel = model.withStructuredOutput(
        GroupChatIntentSchema,
        {
          name: "group_chat_intent",
          method,
        },
      );
      const chain = groupChatIntentPrompt.pipe(structuredModel);

      const result = await chain.invoke(
        {
          groupTitle: params.groupChat.title,
          groupSummary: params.groupChat.summary?.trim() || "暂无",
          agentRoster: formatAgentRoster(params.agents),
          recentHistory: history.length > 0 ? history : "暂无",
          userText: params.userText,
        },
        params.signal ? { signal: params.signal } : undefined,
      );

      return normalizeGroupChatIntent(
        GroupChatIntentSchema.parse(result),
        params.userText,
      );
    } catch (error) {
      // 用户主动取消不算 LLM 失败，直接向上抛，不吞成兜底意图。
      if (params.signal?.aborted) {
        throw error;
      }
      lastError = error;
    }
  }

  console.warn("LangChain group chat intent classification failed", lastError);
  return buildFallbackGroupChatIntent({
    agents: params.agents,
    userText: params.userText,
  });
}

/**
 * 轻量用户情绪识别：三法结构化轮询，失败回关键词兜底；用户取消向上抛不吞。
 * 只判断情绪与陪伴需求，不选 Agent、不生成回复。
 */
async function detectGroupUserEmotionWithLangChain(params: {
  providerConfig: ChatProviderConfig;
  recentMessages: GroupChatMessageWithAgentRow[];
  userText: string;
  signal?: AbortSignal;
}): Promise<GroupChatUserEmotion> {
  let lastError: unknown = null;

  const history = formatGroupHistory(params.recentMessages);

  for (const method of STRUCTURED_OUTPUT_METHODS) {
    try {
      const model = buildLangChainChatModel(params.providerConfig);
      const structuredModel = model.withStructuredOutput(
        GroupChatUserEmotionSchema,
        {
          name: "group_chat_user_emotion",
          method,
        },
      );
      const chain = groupChatUserEmotionPrompt.pipe(structuredModel);

      const result = await chain.invoke(
        {
          recentHistory: history.length > 0 ? history : "暂无",
          userText: params.userText,
        },
        params.signal ? { signal: params.signal } : undefined,
      );

      return GroupChatUserEmotionSchema.parse(result);
    } catch (error) {
      // 用户主动取消不算情绪识别失败，直接向上抛，不吞成关键词兜底。
      if (params.signal?.aborted) {
        throw error;
      }
      lastError = error;
    }
  }

  console.warn("LangChain group chat user emotion detection failed", lastError);
  return buildFallbackGroupUserEmotion(params.userText);
}

function selectionFromLocalRules(input: {
  agents: GroupChatMemberWithAgentRow[];
  userText: string;
  intent: GroupChatIntent;
  speakingContext?: GroupSpeakingContext | null;
  agentRecordsById?: Record<string, UserAgentRecord>;
}): {
  selection: GroupChatAgentSelection;
  selectedAgents: GroupChatMemberWithAgentRow[];
} {
  const selectedAgents = selectAgentsForReply({
    agents: input.agents,
    userText: input.userText,
    speakingContext: input.speakingContext ?? undefined,
    agentRecordsById: input.agentRecordsById,
  });

  const mode: GroupChatAgentSelection["mode"] =
    selectedAgents.length <= 1 ? "single" : input.intent.replyMode;

  return {
    selection: {
      selectedAgentIds: selectedAgents.map((agent) => agent.agentId),
      mode,
      reason: "本地规则兜底选择。",
    },
    selectedAgents,
  };
}

/**
 * 校验模型返回的 selectedAgentIds 是否真实存在，去重截断到上限；
 * 过滤后为空则回退到本地规则。
 */
function normalizeAgentSelection(params: {
  selection: GroupChatAgentSelection;
  agents: GroupChatMemberWithAgentRow[];
  userText: string;
  intent: GroupChatIntent;
  speakingContext?: GroupSpeakingContext | null;
  agentRecordsById?: Record<string, UserAgentRecord>;
}): {
  selection: GroupChatAgentSelection;
  selectedAgents: GroupChatMemberWithAgentRow[];
} {
  const agentById = new Map(
    params.agents.map((agent) => [agent.agentId, agent]),
  );

  const seen = new Set<string>();
  const selectedAgents: GroupChatMemberWithAgentRow[] = [];

  for (const agentId of params.selection.selectedAgentIds) {
    if (seen.has(agentId)) {
      continue;
    }
    const agent = agentById.get(agentId);
    if (!agent) {
      continue;
    }
    seen.add(agentId);
    selectedAgents.push(agent);
    if (selectedAgents.length >= groupReplyAgentLimit) {
      break;
    }
  }

  if (selectedAgents.length === 0) {
    return selectionFromLocalRules({
      agents: params.agents,
      userText: params.userText,
      intent: params.intent,
      speakingContext: params.speakingContext,
      agentRecordsById: params.agentRecordsById,
    });
  }

  const mode: GroupChatAgentSelection["mode"] =
    selectedAgents.length <= 1 ? "single" : params.selection.mode;

  return {
    selection: {
      selectedAgentIds: selectedAgents.map((agent) => agent.agentId),
      mode,
      reason: params.selection.reason,
    },
    selectedAgents,
  };
}

async function selectGroupAgentsWithLangChain(params: {
  providerConfig: ChatProviderConfig;
  agents: GroupChatMemberWithAgentRow[];
  intent: GroupChatIntent;
  userText: string;
  speakingContext?: GroupSpeakingContext | null;
  agentRecordsById?: Record<string, UserAgentRecord>;
  signal?: AbortSignal;
}): Promise<{
  selection: GroupChatAgentSelection;
  selectedAgents: GroupChatMemberWithAgentRow[];
}> {
  let lastError: unknown = null;

  const intentText = [
    `意图：${params.intent.intent}`,
    `点名成员：${
      params.intent.targetAgentNames.length > 0
        ? params.intent.targetAgentNames.join("、")
        : "无"
    }`,
    `是否多人：${params.intent.shouldUseMultipleAgents ? "是" : "否"}`,
    `回复模式：${params.intent.replyMode}`,
    `置信度：${params.intent.confidence.toFixed(2)}`,
    `原因：${params.intent.reason}`,
  ].join("\n");

  const speakingContextText = params.speakingContext
    ? formatSpeakingContextForPrompt({
        speakingContext: params.speakingContext,
        agents: params.agents,
      })
    : "暂无发言权上下文";

  for (const method of STRUCTURED_OUTPUT_METHODS) {
    try {
      const model = buildLangChainChatModel(params.providerConfig);
      const structuredModel = model.withStructuredOutput(
        GroupChatAgentSelectionSchema,
        {
          name: "group_chat_agent_selection",
          method,
        },
      );
      const chain = groupChatSelectionPrompt.pipe(structuredModel);

      const result = await chain.invoke(
        {
          intent: intentText,
          agentRoster: formatAgentRoster(params.agents),
          speakingContext: speakingContextText,
          userText: params.userText,
        },
        params.signal ? { signal: params.signal } : undefined,
      );

      return normalizeAgentSelection({
        selection: GroupChatAgentSelectionSchema.parse(result),
        agents: params.agents,
        userText: params.userText,
        intent: params.intent,
        speakingContext: params.speakingContext,
        agentRecordsById: params.agentRecordsById,
      });
    } catch (error) {
      // 用户主动取消不算 LLM 失败，直接向上抛，不吞成本地规则兜底。
      if (params.signal?.aborted) {
        throw error;
      }
      lastError = error;
    }
  }

  console.warn("LangChain group chat agent selection failed", lastError);
  return selectionFromLocalRules({
    agents: params.agents,
    userText: params.userText,
    intent: params.intent,
    speakingContext: params.speakingContext,
    agentRecordsById: params.agentRecordsById,
  });
}

function plannedReplyToMessageRow(
  reply: PlannedAgentReply,
  createdAtMs: number,
): GroupChatMessageWithAgentRow {
  return {
    id: `planned-${reply.agent.agentId}`,
    groupChatId: reply.agent.id,
    senderType: "agent",
    agentId: reply.agent.agentId,
    agentName: reply.agent.name,
    agentImageKey: reply.agent.imageKey,
    content: reply.content,
    status: reply.status,
    turnIndex: createdAtMs,
    createdAtMs,
  };
}

async function generateSingleReply(params: {
  agent: GroupChatMemberWithAgentRow;
  agents: GroupChatMemberWithAgentRow[];
  agentRecordsById: Record<string, UserAgentRecord>;
  agentMemoriesByAgentId: Record<string, AgentMemoryRecord[]>;
  groupChat: AgentGroupChatRecord;
  providerConfig: ChatProviderConfig;
  recentMessages: GroupChatMessageWithAgentRow[];
  userText: string;
  intent: GroupChatIntent;
  selectionReason: string;
  signal: AbortSignal;
}): Promise<PlannedAgentReply> {
  const agentRecord = params.agentRecordsById[params.agent.agentId];

  if (!agentRecord) {
    return {
      agent: params.agent,
      content: AGENT_REPLY_FALLBACK,
      status: "failed",
      replyKind: "primary",
    };
  }

  try {
    const content = await buildAgentReply({
      activeMemories: params.agentMemoriesByAgentId[params.agent.agentId] ?? [],
      agent: agentRecord,
      allAgents: params.agents,
      groupChat: params.groupChat,
      providerConfig: params.providerConfig,
      recentMessages: params.recentMessages,
      signal: params.signal,
      userText: params.userText,
      intent: params.intent,
      selectionReason: params.selectionReason,
    });

    return {
      agent: params.agent,
      content,
      status: "completed",
      replyKind: "primary",
    };
  } catch (error) {
    // 用户主动取消不算单 Agent 失败，向上抛，不落 failed 占位。
    if (params.signal.aborted) {
      throw error;
    }
    console.warn("群聊 Agent 回复失败", {
      agentId: params.agent.agentId,
      groupChatId: params.groupChat.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      agent: params.agent,
      content: AGENT_REPLY_FALLBACK,
      status: "failed",
      replyKind: "primary",
    };
  }
}

async function generateGroupReplies(params: {
  selectedAgents: GroupChatMemberWithAgentRow[];
  agents: GroupChatMemberWithAgentRow[];
  agentRecordsById: Record<string, UserAgentRecord>;
  agentMemoriesByAgentId: Record<string, AgentMemoryRecord[]>;
  groupChat: AgentGroupChatRecord;
  providerConfig: ChatProviderConfig;
  recentMessages: GroupChatMessageWithAgentRow[];
  userMessage: GroupChatMessageWithAgentRow;
  userText: string;
  intent: GroupChatIntent;
  mode: GroupChatAgentSelection["mode"];
  selectionReason: string;
  signal: AbortSignal;
}): Promise<PlannedAgentReply[]> {
  const baseMessages = [...params.recentMessages, params.userMessage];

  if (params.mode === "multi_parallel") {
    return Promise.all(
      params.selectedAgents.map((agent) =>
        generateSingleReply({
          agent,
          agents: params.agents,
          agentRecordsById: params.agentRecordsById,
          agentMemoriesByAgentId: params.agentMemoriesByAgentId,
          groupChat: params.groupChat,
          providerConfig: params.providerConfig,
          recentMessages: baseMessages,
          userText: params.userText,
          intent: params.intent,
          selectionReason: params.selectionReason,
          signal: params.signal,
        }),
      ),
    );
  }

  const replies: PlannedAgentReply[] = [];

  for (const agent of params.selectedAgents) {
    const plannedRows = replies.map((reply, index) =>
      plannedReplyToMessageRow(
        reply,
        params.userMessage.createdAtMs + index + 1,
      ),
    );

    const reply = await generateSingleReply({
      agent,
      agents: params.agents,
      agentRecordsById: params.agentRecordsById,
      agentMemoriesByAgentId: params.agentMemoriesByAgentId,
      groupChat: params.groupChat,
      providerConfig: params.providerConfig,
      recentMessages: [...baseMessages, ...plannedRows],
      userText: params.userText,
      intent: params.intent,
      selectionReason: params.selectionReason,
      signal: params.signal,
    });

    replies.push(reply);
  }

  return replies;
}

async function checkGroupReplyQualityWithLangChain(params: {
  providerConfig: ChatProviderConfig;
  intent: GroupChatIntent;
  userText: string;
  replies: PlannedAgentReply[];
  signal?: AbortSignal;
}): Promise<GroupChatReplyQuality | null> {
  const completed = params.replies.filter(
    (reply) => reply.status === "completed",
  );

  if (completed.length === 0) {
    return null;
  }

  const intentText = [
    `意图：${params.intent.intent}`,
    `回复模式：${params.intent.replyMode}`,
    `原因：${params.intent.reason}`,
  ].join("\n");

  const repliesText = params.replies
    .map(
      (reply) =>
        `- ${reply.agent.name}（id: ${reply.agent.agentId}）：${reply.content}`,
    )
    .join("\n");

  let lastError: unknown = null;

  for (const method of STRUCTURED_OUTPUT_METHODS) {
    try {
      const model = buildLangChainChatModel(params.providerConfig);
      const structuredModel = model.withStructuredOutput(
        GroupChatReplyQualitySchema,
        {
          name: "group_chat_reply_quality",
          method,
        },
      );
      const chain = groupChatQualityPrompt.pipe(structuredModel);

      const result = await chain.invoke(
        {
          intent: intentText,
          userText: params.userText,
          replies: repliesText,
        },
        params.signal ? { signal: params.signal } : undefined,
      );

      return GroupChatReplyQualitySchema.parse(result);
    } catch (error) {
      // 用户主动取消不算质检失败，直接向上抛，不吞成 quality = null。
      if (params.signal?.aborted) {
        throw error;
      }
      lastError = error;
    }
  }

  console.warn("LangChain group chat reply quality check failed", lastError);
  return null;
}

/**
 * 保守应用质检修订：只有当某 Agent 有非空 revision 文本时才替换其回复。
 * 同一 Agent 本轮出现多条消息（首轮 + 补充回应）时跳过自动覆盖，
 * 避免 revision 按 agentId 粒度把两条混改。
 */
function applyQualityRevisions(
  replies: PlannedAgentReply[],
  quality: GroupChatReplyQuality | null,
): PlannedAgentReply[] {
  if (!quality || quality.revisions.length === 0) {
    return replies;
  }

  const replyCountByAgentId = new Map<string, number>();
  for (const reply of replies) {
    replyCountByAgentId.set(
      reply.agent.agentId,
      (replyCountByAgentId.get(reply.agent.agentId) ?? 0) + 1,
    );
  }

  const revisionByAgentId = new Map(
    quality.revisions
      .filter((revision) => revision.content.trim().length > 0)
      .filter((revision) => replyCountByAgentId.get(revision.agentId) === 1)
      .map((revision) => [revision.agentId, revision.content.trim()]),
  );

  if (revisionByAgentId.size === 0) {
    return replies;
  }

  return replies.map((reply) => {
    const revised = revisionByAgentId.get(reply.agent.agentId);
    if (!revised) {
      return reply;
    }
    return { ...reply, content: revised };
  });
}

/** 规划失败时的降级计划：不追加任何补充回应。 */
function buildDisabledCrossReplyPlan(reason: string): GroupChatCrossReplyPlan {
  return GroupChatCrossReplyPlanSchema.parse({
    enabled: false,
    plans: [],
    reason,
  });
}

/**
 * 归一化补充回应计划：过滤 agentId 是否真实成员、同 Agent 一轮只留一条、
 * respondToAgentId 必须指向首轮已回复的 Agent 且不等于 agentId、
 * angle 收缩到 240 字、最多保留 groupCrossReplyLimit 条。
 * 索引键统一用 member.agentId（不是群成员关系行 id）。
 */
function normalizeCrossReplyPlan(params: {
  plan: GroupChatCrossReplyPlan;
  agents: GroupChatMemberWithAgentRow[];
  primaryReplies: PlannedAgentReply[];
}): GroupChatCrossReplyPlan {
  const agentById = new Map(
    params.agents.map((agent) => [agent.agentId, agent]),
  );
  const primaryReplyAgentIds = new Set(
    params.primaryReplies.map((reply) => reply.agent.agentId),
  );
  const usedAgentIds = new Set<string>();

  const plans = params.plan.plans
    .filter((plan) => agentById.has(plan.agentId))
    .filter((plan) => {
      // 同一 agentId 一轮只保留第一条；add 必须在 filter 内做，
      // 放到后面的 map 里会因 filter/map 分两趟而让去重失效。
      if (usedAgentIds.has(plan.agentId)) {
        return false;
      }
      usedAgentIds.add(plan.agentId);
      return true;
    })
    .filter(
      (plan) =>
        Boolean(plan.respondToAgentId) &&
        primaryReplyAgentIds.has(plan.respondToAgentId as string),
    )
    .filter((plan) => plan.respondToAgentId !== plan.agentId)
    .map((plan) => ({
      agentId: plan.agentId,
      respondToAgentId: plan.respondToAgentId as string,
      angle:
        plan.angle.trim().slice(0, 240) ||
        "补充前面 Agent 的观点，但保持简短。",
    }))
    .slice(0, groupCrossReplyLimit);

  return GroupChatCrossReplyPlanSchema.parse({
    enabled: Boolean(
      params.plan.enabled &&
      plans.length > 0 &&
      params.primaryReplies.length > 0,
    ),
    plans,
    reason:
      params.plan.reason.trim() ||
      "根据首轮回复判断是否需要 Agent 间补充回应。",
  });
}

/**
 * 跑结构化规划器，判断是否需要追加 Agent 间补充回应。
 * 全部结构化方法失败时返回 enabled=false 的降级计划；用户取消向上抛。
 */
async function planCrossRepliesWithLangChain(params: {
  providerConfig: ChatProviderConfig;
  agents: GroupChatMemberWithAgentRow[];
  primaryReplies: PlannedAgentReply[];
  userText: string;
  signal?: AbortSignal;
}): Promise<GroupChatCrossReplyPlan> {
  const primaryRepliesText = params.primaryReplies
    .map(
      (reply) =>
        `- ${reply.agent.name}（id: ${reply.agent.agentId}）：${reply.content}`,
    )
    .join("\n");

  let lastError: unknown = null;

  for (const method of STRUCTURED_OUTPUT_METHODS) {
    try {
      const model = buildLangChainChatModel(params.providerConfig);
      const structuredModel = model.withStructuredOutput(
        GroupChatCrossReplyPlanSchema,
        {
          name: "group_chat_cross_reply_plan",
          method,
        },
      );
      const chain = groupChatCrossReplyPlanPrompt.pipe(structuredModel);

      const result = await chain.invoke(
        {
          agentRoster: formatAgentRoster(params.agents),
          primaryReplies: primaryRepliesText,
          userText: params.userText,
        },
        params.signal ? { signal: params.signal } : undefined,
      );

      return GroupChatCrossReplyPlanSchema.parse(result);
    } catch (error) {
      // 用户主动取消不算规划失败，直接向上抛，不吞成 enabled=false。
      if (params.signal?.aborted) {
        throw error;
      }
      lastError = error;
    }
  }

  console.warn("LangChain group chat cross reply planning failed", lastError);
  return buildDisabledCrossReplyPlan("Agent 间回应规划失败，跳过补充回应。");
}

async function classifyIntentNode(
  state: typeof GroupChatOrchestrationState.State,
) {
  return {
    intent: await classifyGroupIntentWithLangChain({
      providerConfig: state.providerConfig,
      groupChat: state.groupChat,
      agents: state.agents,
      recentMessages: state.recentMessages,
      userText: state.userText,
      signal: state.signal,
    }),
  };
}

async function detectEmotionNode(
  state: typeof GroupChatOrchestrationState.State,
) {
  const userEmotion = await detectGroupUserEmotionWithLangChain({
    providerConfig: state.providerConfig,
    recentMessages: state.recentMessages,
    userText: state.userText,
    signal: state.signal,
  });

  return {
    userEmotion,
    speakingContext: buildGroupSpeakingContext({
      agents: state.agents,
      recentMessages: state.recentMessages,
      userText: state.userText,
      userEmotion,
    }),
  };
}

async function selectAgentsNode(
  state: typeof GroupChatOrchestrationState.State,
) {
  const intent =
    state.intent ??
    buildFallbackGroupChatIntent({
      agents: state.agents,
      userText: state.userText,
    });

  const { selection, selectedAgents } = await selectGroupAgentsWithLangChain({
    providerConfig: state.providerConfig,
    agents: state.agents,
    intent,
    userText: state.userText,
    speakingContext: state.speakingContext,
    agentRecordsById: state.agentRecordsById,
    signal: state.signal,
  });

  return { selection, selectedAgents };
}

async function generateRepliesNode(
  state: typeof GroupChatOrchestrationState.State,
) {
  const intent =
    state.intent ??
    buildFallbackGroupChatIntent({
      agents: state.agents,
      userText: state.userText,
    });

  const replies = await generateGroupReplies({
    selectedAgents: state.selectedAgents,
    agents: state.agents,
    agentRecordsById: state.agentRecordsById,
    agentMemoriesByAgentId: state.agentMemoriesByAgentId,
    groupChat: state.groupChat,
    providerConfig: state.providerConfig,
    recentMessages: state.recentMessages,
    userMessage: state.userMessage,
    userText: state.userText,
    intent,
    mode: state.selection?.mode ?? "single",
    selectionReason: state.selection?.reason ?? "",
    signal: state.signal ?? new AbortController().signal,
  });

  return { replies };
}

async function generateCrossAgentRepliesNode(
  state: typeof GroupChatOrchestrationState.State,
) {
  const primaryReplies = state.replies;

  // 无首轮回复时不追加补充回应，几乎零成本直接返回。
  if (primaryReplies.length === 0) {
    return {
      replies: primaryReplies,
      primaryReplies,
      crossReplyPlan: buildDisabledCrossReplyPlan(
        "本轮无首轮回复，不追加 Agent 间补充回应。",
      ),
    };
  }

  const rawPlan = await planCrossRepliesWithLangChain({
    providerConfig: state.providerConfig,
    agents: state.agents,
    primaryReplies,
    userText: state.userText,
    signal: state.signal,
  });

  const crossReplyPlan = normalizeCrossReplyPlan({
    plan: rawPlan,
    agents: state.agents,
    primaryReplies,
  });

  if (!crossReplyPlan.enabled) {
    return { replies: primaryReplies, primaryReplies, crossReplyPlan };
  }

  const agentById = new Map(
    state.agents.map((agent) => [agent.agentId, agent]),
  );
  const primaryReplyByAgentId = new Map(
    primaryReplies.map((reply) => [reply.agent.agentId, reply]),
  );
  const signal = state.signal ?? new AbortController().signal;
  const baseMessages = [...state.recentMessages, state.userMessage];

  const crossReplies: PlannedAgentReply[] = [];

  for (const plan of crossReplyPlan.plans) {
    const agent = agentById.get(plan.agentId);
    const agentRecord = state.agentRecordsById[plan.agentId];

    if (!agent || !agentRecord) {
      continue;
    }

    const respondToName =
      primaryReplyByAgentId.get(plan.respondToAgentId ?? "")?.agent.name ??
      agentById.get(plan.respondToAgentId ?? "")?.name ??
      "另一位 Agent";

    // 串行生成时把首轮回复 + 已生成的补充回应拼进上下文，让后一条能看到前一条。
    const plannedRows = [...primaryReplies, ...crossReplies].map(
      (reply, index) =>
        plannedReplyToMessageRow(
          reply,
          state.userMessage.createdAtMs + index + 1,
        ),
    );

    try {
      const content = await buildCrossAgentReply({
        activeMemories: state.agentMemoriesByAgentId[plan.agentId] ?? [],
        agent: agentRecord,
        allAgents: state.agents,
        groupChat: state.groupChat,
        providerConfig: state.providerConfig,
        recentMessages: [...baseMessages, ...plannedRows],
        signal,
        userText: state.userText,
        respondToName,
        angle: plan.angle,
      });

      crossReplies.push({
        agent,
        content,
        status: "completed",
        replyKind: "cross_agent",
        respondToAgentId: plan.respondToAgentId,
        crossReplyReason: plan.angle,
        crossReplyRound: groupCrossReplyRoundLimit,
      });
    } catch (error) {
      // 用户主动取消不算补充回应失败，向上抛，不静默跳过。
      if (signal.aborted) {
        throw error;
      }
      // 补充回应是可选增强，单条失败静默跳过，不落 failed 占位。
      console.warn("群聊 Agent 补充回应失败", {
        agentId: plan.agentId,
        groupChatId: state.groupChat.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    replies: [...primaryReplies, ...crossReplies],
    primaryReplies,
    crossReplyPlan,
  };
}

async function checkQualityNode(
  state: typeof GroupChatOrchestrationState.State,
) {
  const intent =
    state.intent ??
    buildFallbackGroupChatIntent({
      agents: state.agents,
      userText: state.userText,
    });

  const quality = await checkGroupReplyQualityWithLangChain({
    providerConfig: state.providerConfig,
    intent,
    userText: state.userText,
    replies: state.replies,
    signal: state.signal,
  });

  return {
    quality,
    replies: applyQualityRevisions(state.replies, quality),
  };
}

const groupChatOrchestrationGraph = new StateGraph(GroupChatOrchestrationState)
  .addNode("classifyIntent", classifyIntentNode)
  .addNode("detectEmotion", detectEmotionNode)
  .addNode("selectAgents", selectAgentsNode)
  .addNode("generateReplies", generateRepliesNode)
  .addNode("generateCrossReplies", generateCrossAgentRepliesNode)
  .addNode("checkQuality", checkQualityNode)
  .addEdge(START, "classifyIntent")
  .addEdge("classifyIntent", "detectEmotion")
  .addEdge("detectEmotion", "selectAgents")
  .addEdge("selectAgents", "generateReplies")
  .addEdge("generateReplies", "generateCrossReplies")
  .addEdge("generateCrossReplies", "checkQuality")
  .addEdge("checkQuality", END)
  .compile();

export interface OrchestrateGroupChatRepliesParams {
  providerConfig: ChatProviderConfig;
  groupChat: AgentGroupChatRecord;
  agents: GroupChatMemberWithAgentRow[];
  recentMessages: GroupChatMessageWithAgentRow[];
  userMessage: GroupChatMessageWithAgentRow;
  userText: string;
  agentMemoriesByAgentId: Record<string, AgentMemoryRecord[]>;
  agentRecordsById: Record<string, UserAgentRecord>;
  signal: AbortSignal;
}

/**
 * 群聊回复编排入口：跑 LangGraph 图，整图失败时用 v1 规则 + 直接生成兜底。
 * 图内无副作用，记忆与人设记录由调用方进图前预取。
 */
export async function orchestrateGroupChatReplies(
  params: OrchestrateGroupChatRepliesParams,
): Promise<GroupChatOrchestrationResult> {
  try {
    const result = await groupChatOrchestrationGraph.invoke(
      {
        providerConfig: params.providerConfig,
        groupChat: params.groupChat,
        agents: params.agents,
        recentMessages: params.recentMessages,
        userMessage: params.userMessage,
        userText: params.userText,
        agentMemoriesByAgentId: params.agentMemoriesByAgentId,
        agentRecordsById: params.agentRecordsById,
        intent: null,
        userEmotion: null,
        speakingContext: null,
        selection: null,
        selectedAgents: [],
        replies: [],
        primaryReplies: [],
        crossReplyPlan: null,
        quality: null,
        signal: params.signal,
      },
      { signal: params.signal },
    );

    const intent =
      result.intent ??
      buildFallbackGroupChatIntent({
        agents: params.agents,
        userText: params.userText,
      });
    const speakingContext =
      result.speakingContext ??
      buildGroupSpeakingContext({
        agents: params.agents,
        recentMessages: params.recentMessages,
        userText: params.userText,
      });
    const fallbackSelection = selectionFromLocalRules({
      agents: params.agents,
      userText: params.userText,
      intent,
      speakingContext,
      agentRecordsById: params.agentRecordsById,
    });

    return {
      intent,
      selection: result.selection ?? fallbackSelection.selection,
      replies: result.replies ?? [],
      quality: result.quality ?? null,
      crossReplyPlan: result.crossReplyPlan ?? null,
      speakingContext,
      usedFallback: false,
    };
  } catch (error) {
    // 用户主动取消不走兜底再生成，直接向上抛，让上层按取消处理。
    if (params.signal.aborted) {
      throw error;
    }
    console.warn("LangGraph group chat orchestration failed", error);
    return runFallbackOrchestration(params);
  }
}

/**
 * 整图失败兜底：buildFallbackGroupChatIntent + selectAgentsForReply + 直接串行生成。
 */
async function runFallbackOrchestration(
  params: OrchestrateGroupChatRepliesParams,
): Promise<GroupChatOrchestrationResult> {
  const intent = buildFallbackGroupChatIntent({
    agents: params.agents,
    userText: params.userText,
  });

  // 整图失败时情绪节点没跑过，这里用关键词兜底情绪现场构造上下文，让打分兜底也生效。
  const speakingContext = buildGroupSpeakingContext({
    agents: params.agents,
    recentMessages: params.recentMessages,
    userText: params.userText,
  });

  const { selection, selectedAgents } = selectionFromLocalRules({
    agents: params.agents,
    userText: params.userText,
    intent,
    speakingContext,
    agentRecordsById: params.agentRecordsById,
  });

  const replies = await generateGroupReplies({
    selectedAgents,
    agents: params.agents,
    agentRecordsById: params.agentRecordsById,
    agentMemoriesByAgentId: params.agentMemoriesByAgentId,
    groupChat: params.groupChat,
    providerConfig: params.providerConfig,
    recentMessages: params.recentMessages,
    userMessage: params.userMessage,
    userText: params.userText,
    intent,
    mode: selection.mode,
    selectionReason: selection.reason,
    signal: params.signal,
  });

  return {
    intent,
    selection,
    replies,
    quality: null,
    crossReplyPlan: buildDisabledCrossReplyPlan(
      "fallback 流程不追加 Agent 间回应。",
    ),
    speakingContext,
    usedFallback: true,
  };
}
