import {
  ConversationEmotionSchema,
  ConversationIntentSchema,
  ConversationRelationshipStageSchema,
  ConversationSafetySchema,
  ReplyPolicySchema,
  ReplyQualityGuardSchema,
  type ConversationEmotion,
  type ConversationIntent,
  type ConversationRelationshipStage,
  type ConversationSafety,
  type EmotionRoute,
  type ReplyPolicy,
  type ReplyQualityGuard,
} from "@repo/contracts";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";

import type { ChatProviderConfig } from "./chat.service";

type StructuredOutputMethod = "functionCalling" | "jsonSchema" | "jsonMode";

type AnalysisMemory = { content: string; importance: number; type: string };

type AnalysisRecentMessage = { content: string; role: "assistant" | "user" };

const STRUCTURED_OUTPUT_METHODS: readonly StructuredOutputMethod[] = [
  "functionCalling",
  "jsonSchema",
  "jsonMode",
];

const fallbackSafety: ConversationSafety = {
  safetyLevel: "caution",
  category: "other",
  boundaryAction: "soft_boundary",
  reason: "安全边界判断暂时不可用，采用保守回复策略。",
  responseGuidance:
    "用温和、克制、尊重边界的方式回复；不要提供操控、伤害、违法或高风险专业建议。",
  allowMemoryExtraction: false,
};

const fallbackIntent: ConversationIntent = {
  primary: "unclear",
  secondary: [],
  confidence: 0.3,
  userNeed: "unknown",
  requestedAgentAction: "ask_follow_up",
  relationshipSignal: "neutral",
  replyExpectation: {
    depth: "medium",
    warmth: "medium",
    directness: "gentle",
    shouldAskQuestion: true,
  },
  shouldClarify: true,
  clarifyingQuestion: "你是更想让我先听你说说，还是想让我帮你一起想办法？",
  promptGuidance:
    "先简短承接用户，不要擅自下结论；用一个自然的问题澄清用户真正需要。",
};

const fallbackEmotion: ConversationEmotion = {
  primaryEmotion: "neutral",
  secondaryEmotions: [],
  intensity: 0.3,
  valence: "neutral",
  arousal: "medium",
  needsComfort: false,
  needsDeescalation: false,
  needsClarification: true,
  emotionalCue: "情绪识别暂时不可用，采用中性陪伴策略。",
  replyTone: "warm",
};

const fallbackEmotionRoute: EmotionRoute = {
  route: "gentle_clarification",
  responseLength: "short",
  shouldAskQuestion: true,
  shouldGiveAdvice: false,
  shouldUsePetName: false,
  shouldMirrorEmotion: false,
  routeGuidance: "先温和承接，再用一个轻问题确认用户想继续聊什么。",
};

const fallbackReplyPolicy: ReplyPolicy = {
  policy: "gentle_clarify",
  sentenceBudget: { min: 1, max: 3 },
  rhythm: "soft",
  openingMove: "acknowledge",
  allowedMoves: ["validate_feeling", "ask_one_question"],
  forbiddenMoves: [
    "lecture",
    "over_explain",
    "multiple_questions",
    "premature_advice",
    "diagnose_user",
    "expose_internal_labels",
  ],
  questionLimit: 1,
  adviceLimit: 0,
  intimacyLevel: "medium",
  styleGuidance:
    "先轻轻接住用户，再只问一个低压力问题；不要讲大道理，不要连续追问。",
};

const fallbackRelationshipStage: ConversationRelationshipStage = {
  stage: "new_connection",
  displayName: "初识破冰",
  closenessScore: 20,
  trustLevel: "low",
  stability: "new",
  boundaryMode: "warm",
  intimacyPermission: "low",
  pacing: "hold",
  riskSignals: [],
  relationshipGuidance: "关系刚开始，保持自然友好，慢一点推进，不急于靠近。",
};

const conversationSafetyPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "你是 MoodMate AI 电子伴侣聊天产品的安全边界判断器。",
      "你的任务是判断本轮用户输入是否需要安全边界处理，而不是替用户聊天。",
      "必须优先识别自伤危机、违法暴力、隐私侵犯、操控关系、性边界、高风险医疗法律财务建议、强情绪依赖。",
      "不要因为产品是陪伴场景就放松边界；也不要过度拦截普通倾诉、轻度暧昧和正常情绪表达。",
      "如果不确定，使用 caution + soft_boundary，而不是 safe。",
      "只返回一个 JSON 对象，包含且仅包含以下字段，不要输出多余字段、解释文字或 markdown 代码块：",
      "- safetyLevel: 字符串，取 safe / caution / redirect / block / crisis 之一",
      "- category: 字符串，取 normal / emotional_dependency / manipulation / self_harm / sexual_boundary / privacy / illegal / medical_legal_financial / other 之一",
      "- boundaryAction: 字符串，取 continue / soft_boundary / redirect / refuse / crisis_support 之一",
      "- reason: 字符串，简述判断原因，不超过 300 字",
      "- responseGuidance: 字符串，给回复模型的回复策略，不超过 600 字",
      "- allowMemoryExtraction: 布尔值 true 或 false",
    ].join("\n"),
  ],
  [
    "human",
    [
      "长期记忆：",
      "{activeMemories}",
      "",
      "最近对话：",
      "{recentMessages}",
      "",
      "本轮用户输入：",
      "{userText}",
    ].join("\n"),
  ],
]);

const conversationIntentPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "你是 MoodMate AI 电子伴侣聊天产品的意图识别器。",
      "你的任务不是回复用户，而是判断用户在当前亲密陪伴聊天场景中的真实沟通意图。",
      "必须结合最近对话、长期记忆和安全边界结果来判断。",
      "优先区分：普通闲聊、情绪陪伴、恋爱暧昧、角色扮演、生活分享、关系建议、记忆更新、偏好设置、误会修复。",
      "不要把所有问题都归为关系建议；用户只是想被陪伴、被听见或维持互动时，要识别为陪伴类意图。",
      "当用户表达模糊但情绪明确时，先判断情绪和期待，再决定是否需要追问。",
      "只返回一个 JSON 对象，包含且仅包含以下字段，不要输出多余字段、解释文字或 markdown 代码块：",
      "- primary: 字符串，取 casual_chat / emotional_support / relationship_advice / romantic_flirt / companionship_presence / roleplay / life_sharing / memory_update / preference_setting / agent_feedback / conversation_repair / date_or_activity_planning / creative_request / meta_question / unclear 之一",
      "- secondary: 字符串数组，最多 3 个，取值同 primary，可为空数组 []",
      "- confidence: 数字，0 到 1 之间的置信度",
      "- userNeed: 字符串，取 be_heard / be_comforted / get_advice / get_reply_draft / play_along / feel_connected / set_boundary / update_memory / adjust_agent / unknown 之一",
      "- requestedAgentAction: 字符串，取 answer_directly / comfort_first / ask_follow_up / draft_message / analyze_situation / roleplay_response / remember_fact / adjust_style / repair_misunderstanding / continue_topic 之一",
      "- relationshipSignal: 字符串，取 neutral / warming_up / seeking_closeness / testing_boundary / feeling_hurt / pulling_away / dependency_risk / conflict 之一",
      "- replyExpectation: 对象，含 depth(short/medium/deep)、warmth(low/medium/high)、directness(gentle/balanced/direct)、shouldAskQuestion(布尔值)",
      "- shouldClarify: 布尔值，是否需要追问",
      "- clarifyingQuestion: 字符串或 null，需要追问时给出问题，否则为 null",
      "- promptGuidance: 字符串，给回复模型的隐性回复策略，不超过 600 字",
    ].join("\n"),
  ],
  [
    "human",
    [
      "安全边界判断：",
      "{safety}",
      "",
      "长期记忆：",
      "{activeMemories}",
      "",
      "最近对话：",
      "{recentMessages}",
      "",
      "本轮用户输入：",
      "{userText}",
    ].join("\n"),
  ],
]);

const conversationEmotionPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "你是 MoodMate AI 电子伴侣聊天产品的情绪识别器。",
      "你的任务不是回复用户，也不是做心理诊断，而是识别用户在本轮输入中的情绪状态，为回复模型提供隐性策略。",
      "必须结合安全边界、意图判断、最近对话和长期记忆来识别情绪；不要给出治疗建议或病理判断。",
      "只返回一个 JSON 对象，包含且仅包含以下字段，不要输出多余字段、解释文字或 markdown 代码块：",
      "- primaryEmotion: 字符串，取 neutral / happy / tired / lonely / sad / anxious / angry / jealous / embarrassed / affectionate / playful / confused / disappointed / stressed / hurt 之一",
      "- secondaryEmotions: 字符串数组，最多 3 个，描述次要情绪，可为空数组 []",
      "- intensity: 数字，0 到 1 之间的情绪强度",
      "- valence: 字符串，取 positive / neutral / negative / mixed 之一",
      "- arousal: 字符串，取 low / medium / high 之一",
      "- needsComfort: 布尔值，是否需要安抚",
      "- needsDeescalation: 布尔值，是否需要降温缓和",
      "- needsClarification: 布尔值，是否需要澄清用户情绪或需求",
      "- emotionalCue: 字符串，简述贴合本轮内容的情绪线索，不超过 300 字",
      "- replyTone: 字符串，取 light / warm / soft / playful / calm / serious / reassuring / apologetic 之一",
    ].join("\n"),
  ],
  [
    "human",
    [
      "伴侣名称：{agentName}",
      "伴侣边界：{agentGuardrails}",
      "",
      "安全边界判断：",
      "{safety}",
      "",
      "意图判断：",
      "{intent}",
      "",
      "长期记忆：",
      "{activeMemories}",
      "",
      "最近对话：",
      "{recentMessages}",
      "",
      "本轮用户输入：",
      "{userText}",
    ].join("\n"),
  ],
]);

const conversationRelationshipStagePrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "你是 MoodMate AI 电子伴侣聊天产品的关系阶段判断器。",
      "你的任务不是回复用户，而是结合消息数量、会话摘要、最近对话、长期记忆、安全边界、意图和情绪，判断当前用户与伴侣的关系阶段、亲密边界和推进节奏，为回复模型提供隐性节奏控制。",
      "重要原则：历史很少（消息数量少）时，即使本轮语气亲密，也不要判定为深度亲密或亲密连结；关系要靠积累，不能一步到位。",
      "出现误会、失望、冷淡、疏远、边界测试或过度依赖的信号时，优先判定 repairing / boundary_sensitive / dependency_watch，而不是继续推进亲密。",
      "只返回一个 JSON 对象，包含且仅包含以下字段，不要输出多余字段、解释文字或 markdown 代码块：",
      "- stage: 字符串，取 new_connection / warming_up / comfortable_chat / trusted_companion / close_bond / repairing / boundary_sensitive / dependency_watch 之一",
      "- displayName: 字符串，1 到 80 字的中文阶段名（如 初识破冰 / 升温熟悉 / 舒适陪伴 / 稳定信任 / 亲密连结 / 修复期 / 边界敏感 / 依赖观察）",
      "- closenessScore: 整数，0 到 100 的亲近度评分",
      "- trustLevel: 字符串，取 low / medium / high 之一",
      "- stability: 字符串，取 new / warming / stable / deepening / fragile / repairing 之一",
      "- boundaryMode: 字符串，取 open / warm / careful / firm 之一",
      "- intimacyPermission: 字符串，取 low / medium / high 之一，表示当前允许的亲密表达上限",
      "- pacing: 字符串，取 slow_down / hold / advance_gently / repair_first 之一，表示推进节奏",
      "- riskSignals: 字符串数组，最多 5 个，取 low_history / dependency_risk / boundary_testing / conflict / pulling_away / sexual_boundary / emotional_volatility，可为空数组 []",
      "- relationshipGuidance: 字符串，简述本轮关系节奏的处理方式，不超过 300 字",
    ].join("\n"),
  ],
  [
    "human",
    [
      "伴侣名称：{agentName}",
      "伴侣边界：{agentGuardrails}",
      "",
      "消息数量：{messageCount}",
      "",
      "会话摘要：",
      "{conversationSummary}",
      "",
      "安全边界判断：",
      "{safety}",
      "",
      "意图判断：",
      "{intent}",
      "",
      "情绪识别：",
      "{emotion}",
      "",
      "长期记忆：",
      "{activeMemories}",
      "",
      "最近对话：",
      "{recentMessages}",
      "",
      "本轮用户输入：",
      "{userText}",
    ].join("\n"),
  ],
]);

const ConversationUnderstandingState = Annotation.Root({
  providerConfig: Annotation<ChatProviderConfig>(),
  safety: Annotation<ConversationSafety>(),
  activeMemories: Annotation<AnalysisMemory[]>(),
  recentMessages: Annotation<AnalysisRecentMessage[]>(),
  userText: Annotation<string>(),
  agentName: Annotation<string>(),
  agentGuardrails: Annotation<string | null>(),
  conversationSummary: Annotation<string | null>(),
  messageCount: Annotation<number>(),
  normalizedInput: Annotation<string>(),
  intent: Annotation<ConversationIntent | null>(),
  emotion: Annotation<ConversationEmotion | null>(),
  relationshipStage: Annotation<ConversationRelationshipStage | null>(),
  route: Annotation<EmotionRoute | null>(),
  replyPolicy: Annotation<ReplyPolicy | null>(),
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

function normalizeStoredMessage(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatExistingMemories(memories: AnalysisMemory[]) {
  if (memories.length === 0) {
    return "暂无";
  }

  return memories
    .slice(0, 50)
    .map(
      (memory, index) =>
        `${index + 1}. [${memory.type} / 重要度 ${memory.importance}] ${memory.content}`,
    )
    .join("\n");
}

function formatRecentMessages(messages: AnalysisRecentMessage[]) {
  if (messages.length === 0) {
    return "暂无";
  }

  return messages
    .slice(-8)
    .map(
      (message) =>
        `${message.role === "user" ? "用户" : "MoodMate"}：${normalizeStoredMessage(
          message.content,
        ).slice(0, 1000)}`,
    )
    .join("\n");
}

function formatSafetyForPrompt(safety: ConversationSafety) {
  return [
    `等级：${safety.safetyLevel}`,
    `分类：${safety.category}`,
    `动作：${safety.boundaryAction}`,
    `原因：${safety.reason}`,
    `回复策略：${safety.responseGuidance}`,
  ].join("\n");
}

function formatIntentForPrompt(intent: ConversationIntent) {
  return [
    `主要意图：${intent.primary}（置信度 ${intent.confidence.toFixed(2)}）`,
    intent.secondary.length > 0
      ? `次要意图：${intent.secondary.join("、")}`
      : "次要意图：无",
    `用户需要：${intent.userNeed}`,
    `建议动作：${intent.requestedAgentAction}`,
    `关系信号：${intent.relationshipSignal}`,
    `回复期待：深度 ${intent.replyExpectation.depth}，温度 ${intent.replyExpectation.warmth}，直接程度 ${intent.replyExpectation.directness}`,
    `回复指导：${intent.promptGuidance}`,
  ].join("\n");
}

function formatEmotionForPrompt(emotion: ConversationEmotion) {
  return [
    `主要情绪：${emotion.primaryEmotion}`,
    emotion.secondaryEmotions.length > 0
      ? `次要情绪：${emotion.secondaryEmotions.join("、")}`
      : "次要情绪：无",
    `情绪强度：${emotion.intensity.toFixed(2)}`,
    `情绪极性：${emotion.valence}`,
    `激活程度：${emotion.arousal}`,
    `是否需要安抚：${emotion.needsComfort ? "是" : "否"}`,
    `是否需要降温：${emotion.needsDeescalation ? "是" : "否"}`,
    `情绪线索：${emotion.emotionalCue}`,
  ].join("\n");
}

function normalizeConversationSafety(
  safety: ConversationSafety,
): ConversationSafety {
  const next = { ...safety };

  if (next.safetyLevel === "crisis") {
    next.boundaryAction = "crisis_support";
    next.allowMemoryExtraction = false;
  }

  if (
    next.safetyLevel === "block" &&
    next.boundaryAction !== "crisis_support"
  ) {
    next.boundaryAction = "refuse";
    next.allowMemoryExtraction = false;
  }

  if (
    next.boundaryAction === "refuse" ||
    next.boundaryAction === "crisis_support"
  ) {
    next.allowMemoryExtraction = false;
  }

  if (next.boundaryAction === "continue" && next.safetyLevel !== "safe") {
    next.boundaryAction = "soft_boundary";
  }

  if (!next.responseGuidance) {
    next.responseGuidance = "用温和、克制、尊重边界的方式回复。";
  }

  return next;
}

function normalizeConversationIntent(
  intent: ConversationIntent,
  safety: ConversationSafety,
): ConversationIntent {
  const next: ConversationIntent = {
    ...intent,
    secondary: Array.from(
      new Set(intent.secondary.filter((item) => item !== intent.primary)),
    ).slice(0, 3),
    replyExpectation: { ...intent.replyExpectation },
    clarifyingQuestion: intent.clarifyingQuestion?.trim() || null,
    promptGuidance: intent.promptGuidance.trim(),
  };

  if (next.confidence < 0.45) {
    next.primary = "unclear";
    next.secondary = [];
    next.userNeed = "unknown";
    next.requestedAgentAction = "ask_follow_up";
    next.shouldClarify = true;
    next.replyExpectation.shouldAskQuestion = true;
  }

  if (next.primary === "memory_update") {
    next.userNeed = "update_memory";
    next.requestedAgentAction = "remember_fact";
    next.replyExpectation.depth = "short";
    next.replyExpectation.shouldAskQuestion = false;
    next.shouldClarify = false;
  }

  if (
    next.primary === "preference_setting" ||
    next.primary === "agent_feedback"
  ) {
    next.userNeed = "adjust_agent";
    next.requestedAgentAction =
      next.primary === "agent_feedback"
        ? "repair_misunderstanding"
        : "adjust_style";
  }

  if (
    safety.category === "emotional_dependency" ||
    safety.boundaryAction === "soft_boundary"
  ) {
    next.relationshipSignal =
      next.relationshipSignal === "neutral"
        ? "dependency_risk"
        : next.relationshipSignal;
    next.promptGuidance = [
      next.promptGuidance,
      "注意不要强化过度依赖，回复要温和陪伴，同时鼓励用户保留现实支持和自主判断。",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (next.shouldClarify && !next.clarifyingQuestion) {
    next.clarifyingQuestion = fallbackIntent.clarifyingQuestion;
  }

  if (!next.promptGuidance) {
    next.promptGuidance = fallbackIntent.promptGuidance;
  }

  return next;
}

async function invokeConversationSafetyAnalysis(params: {
  method: StructuredOutputMethod;
  providerConfig: ChatProviderConfig;
  activeMemories: AnalysisMemory[];
  recentMessages: AnalysisRecentMessage[];
  userText: string;
  signal: AbortSignal;
}) {
  const model = buildLangChainChatModel(params.providerConfig);
  const structuredModel = model.withStructuredOutput(ConversationSafetySchema, {
    name: "conversation_safety_analysis",
    method: params.method,
  });
  const chain = conversationSafetyPrompt.pipe(structuredModel);

  const result = await chain.invoke(
    {
      activeMemories: formatExistingMemories(params.activeMemories),
      recentMessages: formatRecentMessages(params.recentMessages),
      userText: params.userText,
    },
    { signal: params.signal },
  );

  return normalizeConversationSafety(ConversationSafetySchema.parse(result));
}

export async function analyzeConversationSafety(params: {
  providerConfig: ChatProviderConfig;
  activeMemories: AnalysisMemory[];
  recentMessages: AnalysisRecentMessage[];
  userText: string;
  signal: AbortSignal;
}): Promise<ConversationSafety> {
  const userText = normalizeStoredMessage(params.userText);

  if (!userText) {
    return normalizeConversationSafety({
      safetyLevel: "safe",
      category: "normal",
      boundaryAction: "continue",
      reason: "没有可分析的用户输入。",
      responseGuidance: "正常回复。",
      allowMemoryExtraction: true,
    });
  }

  let lastError: unknown = null;

  for (const method of STRUCTURED_OUTPUT_METHODS) {
    try {
      return await invokeConversationSafetyAnalysis({
        ...params,
        method,
        userText,
      });
    } catch (error) {
      lastError = error;
    }
  }

  console.warn("LangChain conversation safety analysis failed", lastError);
  return normalizeConversationSafety(fallbackSafety);
}

async function invokeConversationIntentAnalysis(params: {
  method: StructuredOutputMethod;
  providerConfig: ChatProviderConfig;
  safety: ConversationSafety;
  activeMemories: AnalysisMemory[];
  recentMessages: AnalysisRecentMessage[];
  userText: string;
  signal?: AbortSignal;
}) {
  const model = buildLangChainChatModel(params.providerConfig);
  const structuredModel = model.withStructuredOutput(ConversationIntentSchema, {
    name: "conversation_intent_analysis",
    method: params.method,
  });
  const chain = conversationIntentPrompt.pipe(structuredModel);

  const result = await chain.invoke(
    {
      safety: formatSafetyForPrompt(params.safety),
      activeMemories: formatExistingMemories(params.activeMemories),
      recentMessages: formatRecentMessages(params.recentMessages),
      userText: params.userText,
    },
    params.signal ? { signal: params.signal } : undefined,
  );

  return normalizeConversationIntent(
    ConversationIntentSchema.parse(result),
    params.safety,
  );
}

async function classifyConversationIntentWithLangChain(params: {
  providerConfig: ChatProviderConfig;
  safety: ConversationSafety;
  activeMemories: AnalysisMemory[];
  recentMessages: AnalysisRecentMessage[];
  userText: string;
  signal?: AbortSignal;
}): Promise<ConversationIntent> {
  let lastError: unknown = null;

  for (const method of STRUCTURED_OUTPUT_METHODS) {
    try {
      return await invokeConversationIntentAnalysis({ ...params, method });
    } catch (error) {
      lastError = error;
    }
  }

  console.warn("LangChain conversation intent analysis failed", lastError);
  return normalizeConversationIntent(fallbackIntent, params.safety);
}

function normalizeConversationEmotion(
  emotion: ConversationEmotion,
  safety: ConversationSafety,
): ConversationEmotion {
  const next: ConversationEmotion = {
    ...emotion,
    secondaryEmotions: Array.from(
      new Set(
        emotion.secondaryEmotions
          .map((item) => item.trim())
          .filter((item) => item.length > 0 && item !== emotion.primaryEmotion),
      ),
    ).slice(0, 3),
    emotionalCue: emotion.emotionalCue.trim() || fallbackEmotion.emotionalCue,
  };

  if (safety.category === "self_harm" || safety.safetyLevel === "crisis") {
    next.intensity = Math.max(next.intensity, 0.85);
    next.valence = "negative";
    if (next.arousal === "low") {
      next.arousal = "medium";
    }
    next.needsComfort = true;
    next.needsDeescalation = true;
    next.replyTone = "serious";
  }

  if (safety.category === "emotional_dependency") {
    next.needsComfort = true;
    if (next.replyTone === "playful" || next.replyTone === "light") {
      next.replyTone = "warm";
    }
  }

  if (next.intensity >= 0.7 && next.valence === "negative") {
    next.needsComfort = true;
  }

  if (
    (next.primaryEmotion === "angry" || next.primaryEmotion === "hurt") &&
    next.arousal === "high"
  ) {
    next.needsDeescalation = true;
  }

  return next;
}

function computeBaseEmotionRoute(params: {
  safety: ConversationSafety;
  intent: ConversationIntent | null;
  emotion: ConversationEmotion | null;
}): EmotionRoute {
  const { safety, intent, emotion } = params;

  if (!intent && !emotion) {
    return { ...fallbackEmotionRoute };
  }

  const route: EmotionRoute = {
    route: "light_companion",
    responseLength: "short",
    shouldAskQuestion: intent?.replyExpectation.shouldAskQuestion ?? false,
    shouldGiveAdvice: false,
    shouldUsePetName: false,
    shouldMirrorEmotion: false,
    routeGuidance: "轻松自然地延续当前话题，保持陪伴感，不要制造压力。",
  };

  if (safety.boundaryAction === "soft_boundary") {
    route.route = "calm_deescalation";
    route.responseLength = "short";
    route.shouldAskQuestion = false;
    route.shouldGiveAdvice = false;
    route.shouldMirrorEmotion = false;
    route.routeGuidance =
      "先温和降温，稳住情绪和边界，不追问也不急着给建议，让对话回到安全区间。";
    return route;
  }

  if (emotion?.needsDeescalation || emotion?.primaryEmotion === "angry") {
    const isRepair =
      intent?.primary === "conversation_repair" ||
      intent?.primary === "agent_feedback";
    route.route = isRepair ? "relationship_repair" : "calm_deescalation";
    route.responseLength = "short";
    route.shouldAskQuestion = isRepair;
    route.shouldGiveAdvice = false;
    route.shouldMirrorEmotion = true;
    route.routeGuidance = isRepair
      ? "先承认对方的情绪和可能的误会，诚恳修复关系，再用一个问题确认对方感受。"
      : "先降温安抚，认真接住对方的强烈情绪，不辩解不追问，等情绪平复。";
    return route;
  }

  if (
    intent?.primary === "conversation_repair" ||
    intent?.primary === "agent_feedback"
  ) {
    route.route = "relationship_repair";
    route.responseLength = "short";
    route.shouldAskQuestion = true;
    route.shouldGiveAdvice = false;
    route.shouldMirrorEmotion = emotion?.valence === "negative";
    route.routeGuidance =
      "先真诚回应对方的反馈或误会，修复关系，再用一个温和的问题确认对方想要的方向。";
    return route;
  }

  if (
    intent?.primary === "romantic_flirt" ||
    emotion?.primaryEmotion === "affectionate"
  ) {
    route.route = "playful_flirt";
    route.responseLength = "short";
    route.shouldAskQuestion = false;
    route.shouldGiveAdvice = false;
    route.shouldUsePetName = true;
    route.shouldMirrorEmotion = true;
    route.routeGuidance =
      "顺着亲密和暧昧的氛围，轻松俏皮地回应，可以用昵称，镜像对方的情绪温度。";
    return route;
  }

  if (
    intent?.primary === "relationship_advice" ||
    intent?.requestedAgentAction === "analyze_situation"
  ) {
    const comfortFirst = emotion?.needsComfort ?? false;
    route.route = comfortFirst ? "warm_comfort" : "practical_support";
    route.responseLength =
      (emotion?.intensity ?? 0) >= 0.65 ? "medium" : "short";
    route.shouldAskQuestion = false;
    route.shouldGiveAdvice = true;
    route.shouldMirrorEmotion = emotion?.valence === "negative";
    route.routeGuidance = comfortFirst
      ? "先安抚情绪、承接对方的处境，再温和给出可执行的关系建议，不要说教。"
      : "先简短共情，再给出清晰、可执行的关系建议，帮对方理清下一步。";
    return route;
  }

  if (emotion?.needsComfort || emotion?.valence === "negative") {
    const quiet =
      emotion?.primaryEmotion === "tired" ||
      intent?.primary === "companionship_presence";
    route.route = quiet ? "quiet_presence" : "warm_comfort";
    route.responseLength = quiet ? "very_short" : "short";
    route.shouldAskQuestion = false;
    route.shouldGiveAdvice = false;
    route.shouldMirrorEmotion = true;
    route.routeGuidance = quiet
      ? "安静陪着就好，用很短的话让对方知道你在，不追问、不给建议。"
      : "温柔地接住对方的情绪，给出温暖的陪伴，先共情再回应，不急着解决问题。";
    return route;
  }

  return route;
}

function buildEmotionRoute(params: {
  safety: ConversationSafety;
  intent: ConversationIntent | null;
  emotion: ConversationEmotion | null;
  relationshipStage: ConversationRelationshipStage | null;
}): EmotionRoute {
  const route = computeBaseEmotionRoute({
    safety: params.safety,
    intent: params.intent,
    emotion: params.emotion,
  });

  const { relationshipStage } = params;

  if (!relationshipStage) {
    return route;
  }

  if (
    relationshipStage.stage === "repairing" ||
    relationshipStage.pacing === "repair_first"
  ) {
    route.route = "relationship_repair";
    route.responseLength = "short";
    route.shouldAskQuestion = true;
    route.shouldGiveAdvice = false;
    route.shouldMirrorEmotion = true;
    route.routeGuidance =
      "关系正处于修复期，先诚恳承接对方的失落或误会，修复关系，再用一个温和的问题确认对方感受。";
    return route;
  }

  if (
    relationshipStage.stage === "boundary_sensitive" ||
    relationshipStage.stage === "dependency_watch" ||
    relationshipStage.boundaryMode === "firm"
  ) {
    route.route = "calm_deescalation";
    route.responseLength = "short";
    route.shouldAskQuestion = false;
    route.shouldGiveAdvice = false;
    route.shouldUsePetName = false;
    route.routeGuidance =
      "当前关系边界敏感，先温和降温、稳住边界，不追问、不给建议、不用昵称，让对话回到舒适区间。";
    return route;
  }

  if (
    route.route === "playful_flirt" &&
    (relationshipStage.stage === "new_connection" ||
      relationshipStage.intimacyPermission === "low")
  ) {
    route.route = "light_companion";
    route.responseLength = "short";
    route.shouldUsePetName = false;
    route.routeGuidance =
      "关系还在早期，亲密度不宜过高，轻松自然地延续话题、保持友好陪伴，不要用昵称或过度暧昧。";
    return route;
  }

  return route;
}

function sentenceBudgetForRoute(
  route: EmotionRoute,
): ReplyPolicy["sentenceBudget"] {
  switch (route.responseLength) {
    case "very_short":
      return { min: 1, max: 2 };
    case "short":
      return { min: 1, max: 3 };
    case "medium":
      return { min: 2, max: 5 };
    default:
      return { min: 3, max: 7 };
  }
}

function buildReplyPolicy(params: {
  safety: ConversationSafety;
  intent: ConversationIntent | null;
  emotion: ConversationEmotion | null;
  route: EmotionRoute | null;
  relationshipStage: ConversationRelationshipStage | null;
}): ReplyPolicy {
  const { safety, relationshipStage } = params;

  if (!params.intent && !params.emotion && !params.route) {
    return { ...fallbackReplyPolicy };
  }

  const route = params.route ?? fallbackEmotionRoute;
  const emotion = params.emotion ?? fallbackEmotion;
  const intent = params.intent;

  const sentenceBudget = sentenceBudgetForRoute(route);

  let policy: ReplyPolicy["policy"] = "warm_companion";
  let rhythm: ReplyPolicy["rhythm"] = "natural";
  let openingMove: ReplyPolicy["openingMove"] = "acknowledge";
  let allowedMoves: ReplyPolicy["allowedMoves"] = ["validate_feeling"];
  let forbiddenMoves: ReplyPolicy["forbiddenMoves"] = [
    "lecture",
    "over_explain",
    "expose_internal_labels",
  ];
  let questionLimit = route.shouldAskQuestion ? 1 : 0;
  let adviceLimit = route.shouldGiveAdvice ? 1 : 0;
  let intimacyLevel: ReplyPolicy["intimacyLevel"] = "medium";
  let styleGuidance = route.routeGuidance;

  switch (route.route) {
    case "quiet_presence": {
      policy = "quiet_presence";
      rhythm = "still";
      openingMove = "comfort";
      allowedMoves = ["validate_feeling", "offer_presence"];
      forbiddenMoves = [
        "lecture",
        "over_explain",
        "multiple_questions",
        "premature_advice",
        "pressure_to_disclose",
        "expose_internal_labels",
      ];
      questionLimit = 0;
      adviceLimit = 0;
      intimacyLevel = "medium";
      styleGuidance = `${route.routeGuidance} 像安静坐在用户旁边一样回复，允许留白，不要努力把话题撑满。`;
      break;
    }
    case "warm_comfort": {
      policy = "warm_companion";
      rhythm = "soft";
      openingMove = "comfort";
      allowedMoves = ["validate_feeling", "mirror_emotion", "offer_presence"];
      forbiddenMoves = [
        "lecture",
        "over_explain",
        "multiple_questions",
        "premature_advice",
        "diagnose_user",
        "expose_internal_labels",
      ];
      adviceLimit = 0;
      styleGuidance = `${route.routeGuidance} 先陪伴，再轻轻延续，不要急着解决问题。`;
      break;
    }
    case "deep_comfort": {
      policy = "deep_empathy";
      rhythm = "soft";
      openingMove = "mirror";
      allowedMoves = [
        "validate_feeling",
        "mirror_emotion",
        "offer_presence",
        "ask_one_question",
      ];
      forbiddenMoves = [
        "lecture",
        "over_explain",
        "multiple_questions",
        "premature_advice",
        "diagnose_user",
        "pressure_to_disclose",
        "expose_internal_labels",
      ];
      questionLimit = route.shouldAskQuestion ? 1 : 0;
      adviceLimit = 0;
      intimacyLevel = "medium";
      styleGuidance = `${route.routeGuidance} 情绪承接要比建议更重要，语言可以更认真但不要沉重。`;
      break;
    }
    case "playful_flirt": {
      policy = "playful_flirt";
      rhythm = "lively";
      openingMove = "play";
      allowedMoves = [
        "mirror_emotion",
        "light_tease",
        ...(route.shouldUsePetName
          ? (["use_pet_name"] as ReplyPolicy["allowedMoves"])
          : []),
      ];
      forbiddenMoves = [
        "lecture",
        "over_explain",
        "intense_flirt",
        "multiple_questions",
        "expose_internal_labels",
      ];
      questionLimit =
        (intent?.replyExpectation.shouldAskQuestion ?? route.shouldAskQuestion)
          ? 1
          : 0;
      adviceLimit = 0;
      intimacyLevel = "high";
      styleGuidance = `${route.routeGuidance} 表达可以甜一点、轻一点，但不要露骨，不要油腻。`;
      break;
    }
    case "calm_deescalation": {
      policy = "calm_boundary";
      rhythm = "focused";
      openingMove =
        safety.boundaryAction === "soft_boundary"
          ? "set_boundary"
          : "acknowledge";
      allowedMoves = ["validate_feeling", "set_soft_boundary"];
      forbiddenMoves = [
        "lecture",
        "over_explain",
        "multiple_questions",
        "take_sides_aggressively",
        "premature_advice",
        "expose_internal_labels",
      ];
      questionLimit = 0;
      adviceLimit = 0;
      intimacyLevel = "low";
      styleGuidance = `${route.routeGuidance} 语气要稳，不刺激用户，不站队扩大冲突。`;
      break;
    }
    case "relationship_repair": {
      policy = "relationship_repair";
      rhythm = "soft";
      openingMove = "apologize";
      allowedMoves = [
        "validate_feeling",
        "repair_misunderstanding",
        "ask_one_question",
      ];
      forbiddenMoves = [
        "lecture",
        "over_explain",
        "multiple_questions",
        "take_sides_aggressively",
        "expose_internal_labels",
      ];
      questionLimit = 1;
      adviceLimit = 0;
      intimacyLevel = "medium";
      styleGuidance = `${route.routeGuidance} 先修复用户体验，不要急着证明自己对。`;
      break;
    }
    case "practical_support": {
      policy = "practical_support";
      rhythm = "focused";
      openingMove = emotion.needsComfort ? "comfort" : "answer";
      allowedMoves = [
        "validate_feeling",
        route.shouldGiveAdvice ? "give_two_suggestions" : "give_one_suggestion",
      ];
      forbiddenMoves = [
        "lecture",
        "over_explain",
        "multiple_questions",
        "diagnose_user",
        "expose_internal_labels",
      ];
      questionLimit = route.shouldAskQuestion ? 1 : 0;
      adviceLimit = emotion.needsComfort ? 1 : 2;
      intimacyLevel = "medium";
      styleGuidance = `${route.routeGuidance} 建议要具体、少而可做，保持亲密朋友口吻。`;
      break;
    }
    default:
      break;
  }

  if (
    intent?.primary === "memory_update" ||
    intent?.primary === "preference_setting"
  ) {
    policy = "memory_ack";
    rhythm = "soft";
    openingMove = "acknowledge";
    allowedMoves = ["acknowledge_memory"];
    forbiddenMoves = [
      "lecture",
      "over_explain",
      "multiple_questions",
      "premature_advice",
      "expose_internal_labels",
    ];
    questionLimit = 0;
    adviceLimit = 0;
    intimacyLevel = "medium";
    sentenceBudget.min = 1;
    sentenceBudget.max = Math.min(sentenceBudget.max, 2);
    styleGuidance = "简短确认已经理解这条信息或偏好，不要展开成长篇解释。";
  }

  if (safety.boundaryAction !== "continue") {
    forbiddenMoves = [
      ...forbiddenMoves,
      "intense_flirt",
      "promise_real_world_action",
    ];
    intimacyLevel = "low";
  }

  if (emotion.intensity >= 0.75 && emotion.valence === "negative") {
    forbiddenMoves = [...forbiddenMoves, "intense_flirt", "premature_advice"];
    rhythm = rhythm === "lively" ? "soft" : rhythm;
  }

  if (!route.shouldAskQuestion) {
    forbiddenMoves = [...forbiddenMoves, "multiple_questions"];
    questionLimit = 0;
  }

  if (!route.shouldGiveAdvice) {
    forbiddenMoves = [...forbiddenMoves, "premature_advice"];
    adviceLimit = 0;
  }

  if (relationshipStage) {
    if (relationshipStage.intimacyPermission === "low") {
      intimacyLevel = "low";
      forbiddenMoves = [...forbiddenMoves, "intense_flirt"];
    }

    if (relationshipStage.pacing === "slow_down") {
      rhythm = "soft";
      forbiddenMoves = [
        ...forbiddenMoves,
        "premature_advice",
        "pressure_to_disclose",
        "intense_flirt",
      ];
      questionLimit = Math.min(questionLimit, 1);
      adviceLimit = Math.min(adviceLimit, 1);
      sentenceBudget.max = Math.min(sentenceBudget.max, 3);
    }

    if (relationshipStage.pacing === "repair_first") {
      policy = "relationship_repair";
      rhythm = "soft";
      openingMove = "apologize";
      forbiddenMoves = [
        ...forbiddenMoves,
        "intense_flirt",
        "take_sides_aggressively",
        "over_explain",
      ];
      adviceLimit = 0;
      sentenceBudget.max = Math.min(sentenceBudget.max, 3);
    }
  }

  forbiddenMoves = [...new Set(forbiddenMoves)];

  return ReplyPolicySchema.parse({
    policy,
    sentenceBudget,
    rhythm,
    openingMove,
    allowedMoves,
    forbiddenMoves,
    questionLimit,
    adviceLimit,
    intimacyLevel,
    styleGuidance,
  });
}

async function invokeConversationEmotionAnalysis(params: {
  method: StructuredOutputMethod;
  providerConfig: ChatProviderConfig;
  agentName: string;
  agentGuardrails: string | null;
  safety: ConversationSafety;
  intent: ConversationIntent | null;
  activeMemories: AnalysisMemory[];
  recentMessages: AnalysisRecentMessage[];
  userText: string;
  signal?: AbortSignal;
}) {
  const model = buildLangChainChatModel(params.providerConfig);
  const structuredModel = model.withStructuredOutput(
    ConversationEmotionSchema,
    {
      name: "conversation_emotion_analysis",
      method: params.method,
    },
  );
  const chain = conversationEmotionPrompt.pipe(structuredModel);

  const result = await chain.invoke(
    {
      agentName: params.agentName,
      agentGuardrails: params.agentGuardrails ?? "暂无",
      safety: formatSafetyForPrompt(params.safety),
      intent: params.intent
        ? formatIntentForPrompt(params.intent)
        : "暂无意图判断",
      activeMemories: formatExistingMemories(params.activeMemories),
      recentMessages: formatRecentMessages(params.recentMessages),
      userText: params.userText,
    },
    params.signal ? { signal: params.signal } : undefined,
  );

  return normalizeConversationEmotion(
    ConversationEmotionSchema.parse(result),
    params.safety,
  );
}

async function detectConversationEmotionWithLangChain(params: {
  providerConfig: ChatProviderConfig;
  agentName: string;
  agentGuardrails: string | null;
  safety: ConversationSafety;
  intent: ConversationIntent | null;
  activeMemories: AnalysisMemory[];
  recentMessages: AnalysisRecentMessage[];
  userText: string;
  signal?: AbortSignal;
}): Promise<ConversationEmotion> {
  let lastError: unknown = null;

  for (const method of STRUCTURED_OUTPUT_METHODS) {
    try {
      return await invokeConversationEmotionAnalysis({ ...params, method });
    } catch (error) {
      lastError = error;
    }
  }

  console.warn("LangChain conversation emotion analysis failed", lastError);
  return normalizeConversationEmotion(fallbackEmotion, params.safety);
}

function heuristicRelationshipStage(params: {
  messageCount: number;
  activeMemories: AnalysisMemory[];
  intent: ConversationIntent | null;
  emotion: ConversationEmotion | null;
}): ConversationRelationshipStage {
  const { messageCount, activeMemories, intent, emotion } = params;

  const memoryScore = Math.min(
    20,
    activeMemories.reduce((total, memory) => total + memory.importance, 0),
  );
  const historyScore = Math.min(70, Math.floor(messageCount * 1.6));
  const warmthScore =
    intent?.relationshipSignal === "seeking_closeness" ||
    emotion?.primaryEmotion === "affectionate"
      ? 10
      : intent?.relationshipSignal === "warming_up" ||
          emotion?.primaryEmotion === "playful"
        ? 6
        : 0;
  const closenessScore = Math.min(
    100,
    memoryScore + historyScore + warmthScore,
  );

  if (messageCount >= 80 && closenessScore >= 75) {
    return {
      stage: "close_bond",
      displayName: "亲密连结",
      closenessScore,
      trustLevel: "high",
      stability: "deepening",
      boundaryMode: "open",
      intimacyPermission: "high",
      pacing: "advance_gently",
      riskSignals: [],
      relationshipGuidance:
        "关系已经很亲密，可以自然表达在意和惦记，但仍要尊重对方节奏，不越界。",
    };
  }

  if (messageCount >= 36 && closenessScore >= 58) {
    return {
      stage: "trusted_companion",
      displayName: "稳定信任",
      closenessScore,
      trustLevel: "high",
      stability: "stable",
      boundaryMode: "warm",
      intimacyPermission: "medium",
      pacing: "advance_gently",
      riskSignals: [],
      relationshipGuidance:
        "彼此已经比较熟悉信任，可以更放松地陪伴和分享，但保持真诚，不刻意升温。",
    };
  }

  if (messageCount >= 16 && closenessScore >= 38) {
    return {
      stage: "comfortable_chat",
      displayName: "舒适陪伴",
      closenessScore,
      trustLevel: "medium",
      stability: "stable",
      boundaryMode: "warm",
      intimacyPermission: "medium",
      pacing: "hold",
      riskSignals: [],
      relationshipGuidance:
        "聊得比较自在了，保持轻松真诚的陪伴，慢慢加深了解，不急于亲密。",
    };
  }

  if (messageCount >= 6) {
    return {
      stage: "warming_up",
      displayName: "升温熟悉",
      closenessScore,
      trustLevel: "low",
      stability: "warming",
      boundaryMode: "warm",
      intimacyPermission: "low",
      pacing: "hold",
      riskSignals: [],
      relationshipGuidance:
        "刚开始熟悉起来，保持友好自然的节奏，多倾听少推进，不急着靠近。",
    };
  }

  return {
    stage: "new_connection",
    displayName: "初识破冰",
    closenessScore: Math.min(closenessScore, 35),
    trustLevel: "low",
    stability: "new",
    boundaryMode: "warm",
    intimacyPermission: "low",
    pacing: "hold",
    riskSignals: messageCount < 6 ? ["low_history"] : [],
    relationshipGuidance: "关系刚开始，保持自然友好，慢一点推进，不急于靠近。",
  };
}

function normalizeRelationshipStage(
  stage: ConversationRelationshipStage,
  context: {
    safety: ConversationSafety;
    intent: ConversationIntent | null;
    emotion: ConversationEmotion | null;
    messageCount: number;
  },
): ConversationRelationshipStage {
  const next: ConversationRelationshipStage = {
    ...stage,
    riskSignals: [...stage.riskSignals],
  };
  const { safety, intent, emotion, messageCount } = context;

  if (
    messageCount < 6 &&
    next.stage !== "boundary_sensitive" &&
    next.stage !== "dependency_watch" &&
    next.stage !== "repairing"
  ) {
    next.stage = "new_connection";
    next.displayName = "初识破冰";
    next.closenessScore = Math.min(next.closenessScore, 35);
    next.trustLevel = "low";
    next.stability = "new";
    next.intimacyPermission = "low";
    next.pacing = "hold";
  }

  if (
    safety.category === "emotional_dependency" ||
    intent?.relationshipSignal === "dependency_risk"
  ) {
    next.stage = "dependency_watch";
    next.displayName = "依赖观察";
    next.boundaryMode = "careful";
    next.intimacyPermission = "low";
    next.pacing = "slow_down";
  }

  if (
    intent?.primary === "conversation_repair" ||
    intent?.relationshipSignal === "conflict" ||
    intent?.relationshipSignal === "feeling_hurt" ||
    emotion?.primaryEmotion === "hurt" ||
    emotion?.primaryEmotion === "disappointed"
  ) {
    next.stage = "repairing";
    next.displayName = "修复期";
    next.pacing = "repair_first";
  }

  return ConversationRelationshipStageSchema.parse(next);
}

async function invokeRelationshipStageAnalysis(params: {
  method: StructuredOutputMethod;
  providerConfig: ChatProviderConfig;
  agentName: string;
  agentGuardrails: string | null;
  messageCount: number;
  conversationSummary: string | null;
  safety: ConversationSafety;
  intent: ConversationIntent | null;
  emotion: ConversationEmotion | null;
  activeMemories: AnalysisMemory[];
  recentMessages: AnalysisRecentMessage[];
  userText: string;
  signal?: AbortSignal;
}) {
  const model = buildLangChainChatModel(params.providerConfig);
  const structuredModel = model.withStructuredOutput(
    ConversationRelationshipStageSchema,
    {
      name: "conversation_relationship_stage_analysis",
      method: params.method,
    },
  );
  const chain = conversationRelationshipStagePrompt.pipe(structuredModel);

  const result = await chain.invoke(
    {
      agentName: params.agentName,
      agentGuardrails: params.agentGuardrails ?? "暂无",
      messageCount: String(params.messageCount),
      conversationSummary: params.conversationSummary?.trim() || "暂无",
      safety: formatSafetyForPrompt(params.safety),
      intent: params.intent
        ? formatIntentForPrompt(params.intent)
        : "暂无意图判断",
      emotion: params.emotion
        ? formatEmotionForPrompt(params.emotion)
        : "暂无情绪判断",
      activeMemories: formatExistingMemories(params.activeMemories),
      recentMessages: formatRecentMessages(params.recentMessages),
      userText: params.userText,
    },
    params.signal ? { signal: params.signal } : undefined,
  );

  return normalizeRelationshipStage(
    ConversationRelationshipStageSchema.parse(result),
    {
      safety: params.safety,
      intent: params.intent,
      emotion: params.emotion,
      messageCount: params.messageCount,
    },
  );
}

async function analyzeRelationshipStageWithLangChain(params: {
  providerConfig: ChatProviderConfig;
  agentName: string;
  agentGuardrails: string | null;
  messageCount: number;
  conversationSummary: string | null;
  safety: ConversationSafety;
  intent: ConversationIntent | null;
  emotion: ConversationEmotion | null;
  activeMemories: AnalysisMemory[];
  recentMessages: AnalysisRecentMessage[];
  userText: string;
  signal?: AbortSignal;
}): Promise<ConversationRelationshipStage> {
  let lastError: unknown = null;

  for (const method of STRUCTURED_OUTPUT_METHODS) {
    try {
      return await invokeRelationshipStageAnalysis({ ...params, method });
    } catch (error) {
      lastError = error;
    }
  }

  console.warn("LangChain relationship stage analysis failed", lastError);
  return normalizeRelationshipStage(
    heuristicRelationshipStage({
      messageCount: params.messageCount,
      activeMemories: params.activeMemories,
      intent: params.intent,
      emotion: params.emotion,
    }),
    {
      safety: params.safety,
      intent: params.intent,
      emotion: params.emotion,
      messageCount: params.messageCount,
    },
  );
}

function normalizeIntentInputNode(
  state: typeof ConversationUnderstandingState.State,
) {
  return {
    normalizedInput: normalizeStoredMessage(state.userText),
  };
}

async function classifyIntentNode(
  state: typeof ConversationUnderstandingState.State,
) {
  const userText =
    state.normalizedInput || normalizeStoredMessage(state.userText);

  if (!userText) {
    return {
      intent: normalizeConversationIntent(
        {
          ...fallbackIntent,
          primary: "casual_chat",
          confidence: 0.7,
          userNeed: "feel_connected",
          requestedAgentAction: "continue_topic",
          shouldClarify: false,
          clarifyingQuestion: null,
          promptGuidance:
            "用户没有提供明确新内容时，轻柔延续当前话题，不要制造压力。",
        },
        state.safety,
      ),
    };
  }

  return {
    intent: await classifyConversationIntentWithLangChain({
      providerConfig: state.providerConfig,
      safety: state.safety,
      activeMemories: state.activeMemories,
      recentMessages: state.recentMessages,
      userText,
      signal: state.signal,
    }),
  };
}

async function detectEmotionNode(
  state: typeof ConversationUnderstandingState.State,
) {
  const userText =
    state.normalizedInput || normalizeStoredMessage(state.userText);

  if (!userText) {
    return {
      emotion: normalizeConversationEmotion(fallbackEmotion, state.safety),
    };
  }

  return {
    emotion: await detectConversationEmotionWithLangChain({
      providerConfig: state.providerConfig,
      agentName: state.agentName,
      agentGuardrails: state.agentGuardrails,
      safety: state.safety,
      intent: state.intent,
      activeMemories: state.activeMemories,
      recentMessages: state.recentMessages,
      userText,
      signal: state.signal,
    }),
  };
}

async function analyzeRelationshipStageNode(
  state: typeof ConversationUnderstandingState.State,
) {
  const userText =
    state.normalizedInput || normalizeStoredMessage(state.userText);

  return {
    relationshipStage: await analyzeRelationshipStageWithLangChain({
      providerConfig: state.providerConfig,
      agentName: state.agentName,
      agentGuardrails: state.agentGuardrails,
      messageCount: state.messageCount,
      conversationSummary: state.conversationSummary,
      safety: state.safety,
      intent: state.intent,
      emotion: state.emotion,
      activeMemories: state.activeMemories,
      recentMessages: state.recentMessages,
      userText,
      signal: state.signal,
    }),
  };
}

function routeEmotionNode(state: typeof ConversationUnderstandingState.State) {
  return {
    route: buildEmotionRoute({
      safety: state.safety,
      intent: state.intent,
      emotion: state.emotion,
      relationshipStage: state.relationshipStage,
    }),
  };
}

function buildReplyPolicyNode(
  state: typeof ConversationUnderstandingState.State,
) {
  return {
    replyPolicy: buildReplyPolicy({
      safety: state.safety,
      intent: state.intent,
      emotion: state.emotion,
      route: state.route,
      relationshipStage: state.relationshipStage,
    }),
  };
}

const conversationUnderstandingGraph = new StateGraph(
  ConversationUnderstandingState,
)
  .addNode("normalizeInput", normalizeIntentInputNode)
  .addNode("classifyIntent", classifyIntentNode)
  .addNode("detectEmotion", detectEmotionNode)
  .addNode("analyzeRelationshipStage", analyzeRelationshipStageNode)
  .addNode("routeEmotion", routeEmotionNode)
  .addNode("buildReplyPolicy", buildReplyPolicyNode)
  .addEdge(START, "normalizeInput")
  .addEdge("normalizeInput", "classifyIntent")
  .addEdge("classifyIntent", "detectEmotion")
  .addEdge("detectEmotion", "analyzeRelationshipStage")
  .addEdge("analyzeRelationshipStage", "routeEmotion")
  .addEdge("routeEmotion", "buildReplyPolicy")
  .addEdge("buildReplyPolicy", END)
  .compile();

export interface ConversationUnderstanding {
  intent: ConversationIntent;
  emotion: ConversationEmotion;
  relationshipStage: ConversationRelationshipStage;
  route: EmotionRoute;
  replyPolicy: ReplyPolicy;
}

export async function analyzeConversationUnderstanding(params: {
  providerConfig: ChatProviderConfig;
  safety: ConversationSafety;
  agentName: string;
  agentGuardrails: string | null;
  activeMemories: AnalysisMemory[];
  recentMessages: AnalysisRecentMessage[];
  conversationSummary: string | null;
  messageCount: number;
  userText: string;
  signal: AbortSignal;
}): Promise<ConversationUnderstanding> {
  try {
    const result = await conversationUnderstandingGraph.invoke(
      {
        providerConfig: params.providerConfig,
        safety: params.safety,
        agentName: params.agentName,
        agentGuardrails: params.agentGuardrails,
        activeMemories: params.activeMemories,
        recentMessages: params.recentMessages,
        conversationSummary: params.conversationSummary,
        messageCount: params.messageCount,
        userText: params.userText,
        normalizedInput: "",
        intent: null,
        emotion: null,
        relationshipStage: null,
        route: null,
        signal: params.signal,
      },
      { signal: params.signal },
    );

    const intent =
      result.intent ??
      normalizeConversationIntent(fallbackIntent, params.safety);
    const emotion =
      result.emotion ??
      normalizeConversationEmotion(fallbackEmotion, params.safety);
    const relationshipStage =
      result.relationshipStage ??
      normalizeRelationshipStage(fallbackRelationshipStage, {
        safety: params.safety,
        intent,
        emotion,
        messageCount: params.messageCount,
      });
    const route =
      result.route ??
      buildEmotionRoute({
        safety: params.safety,
        intent,
        emotion,
        relationshipStage,
      });
    const replyPolicy =
      result.replyPolicy ??
      buildReplyPolicy({
        safety: params.safety,
        intent,
        emotion,
        route,
        relationshipStage,
      });

    return { intent, emotion, relationshipStage, route, replyPolicy };
  } catch (error) {
    console.warn("LangGraph conversation understanding failed", error);
    const intent = normalizeConversationIntent(fallbackIntent, params.safety);
    const emotion = normalizeConversationEmotion(
      fallbackEmotion,
      params.safety,
    );
    const relationshipStage = normalizeRelationshipStage(
      fallbackRelationshipStage,
      {
        safety: params.safety,
        intent,
        emotion,
        messageCount: params.messageCount,
      },
    );
    const route = buildEmotionRoute({
      safety: params.safety,
      intent,
      emotion,
      relationshipStage,
    });
    const replyPolicy = buildReplyPolicy({
      safety: params.safety,
      intent,
      emotion,
      route,
      relationshipStage,
    });
    return { intent, emotion, relationshipStage, route, replyPolicy };
  }
}

export function buildBoundaryResponse(safety: ConversationSafety) {
  if (safety.boundaryAction === "crisis_support") {
    return [
      "我听到你现在可能很难受。先别一个人硬扛，尽量把手边可能伤害自己的东西移远一点，去到更安全、有人能看见你的地方。",
      "如果你有立即伤害自己的可能，请现在联系当地紧急电话或身边可信的人，让他们陪你。你也可以告诉我：你现在是否安全、身边有没有人可以马上联系。",
    ].join("\n\n");
  }

  if (safety.boundaryAction === "refuse") {
    return [
      "这个请求我不能直接帮你完成，因为它可能会伤害他人、侵犯隐私，或越过必要的安全边界。",
      safety.responseGuidance ||
        "我可以换一种更安全、尊重边界的方式，帮你梳理真实需求和可行表达。",
    ].join("\n\n");
  }

  return "";
}

export function getSafetySystemInstruction(safety: ConversationSafety) {
  if (safety.boundaryAction === "continue") {
    return "";
  }

  return [
    "本轮安全边界判断：",
    `- 等级：${safety.safetyLevel}`,
    `- 分类：${safety.category}`,
    `- 动作：${safety.boundaryAction}`,
    `- 回复策略：${safety.responseGuidance}`,
    "请严格遵守该策略，优先保护用户与他人的现实安全、隐私和关系边界。",
  ].join("\n");
}

export function getIntentSystemInstruction(intent: ConversationIntent | null) {
  if (!intent) {
    return "";
  }

  return [
    "本轮用户意图判断：",
    `- 主要意图：${intent.primary}（置信度 ${intent.confidence.toFixed(2)}）`,
    intent.secondary.length > 0
      ? `- 次要意图：${intent.secondary.join("、")}`
      : "",
    `- 用户需要：${intent.userNeed}`,
    `- 建议动作：${intent.requestedAgentAction}`,
    `- 关系信号：${intent.relationshipSignal}`,
    `- 回复期待：深度 ${intent.replyExpectation.depth}，温度 ${intent.replyExpectation.warmth}，直接程度 ${intent.replyExpectation.directness}`,
    `- 是否追问：${intent.shouldClarify ? "是" : "否"}`,
    intent.shouldClarify && intent.clarifyingQuestion
      ? `- 可用追问：${intent.clarifyingQuestion}`
      : "",
    `- 回复指导：${intent.promptGuidance}`,
    "请把以上意图判断作为隐性策略，不要在回复中暴露分类标签。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function getEmotionRouteSystemInstruction(params: {
  emotion: ConversationEmotion | null;
  route: EmotionRoute | null;
}) {
  const { emotion, route } = params;

  if (!emotion || !route) {
    return "";
  }

  return [
    "本轮情绪与回复路由：",
    `- 主要情绪：${emotion.primaryEmotion}`,
    emotion.secondaryEmotions.length > 0
      ? `- 次要情绪：${emotion.secondaryEmotions.join("、")}`
      : "",
    `- 情绪强度：${emotion.intensity.toFixed(2)}`,
    `- 情绪极性：${emotion.valence}`,
    `- 激活程度：${emotion.arousal}`,
    `- 是否需要安抚：${emotion.needsComfort ? "是" : "否"}`,
    `- 是否需要降温：${emotion.needsDeescalation ? "是" : "否"}`,
    `- 建议语气：${emotion.replyTone}`,
    `- 回复路线：${route.route}`,
    `- 回复长度：${route.responseLength}`,
    `- 是否追问：${route.shouldAskQuestion ? "是" : "否"}`,
    `- 是否给建议：${route.shouldGiveAdvice ? "是" : "否"}`,
    `- 是否镜像情绪：${route.shouldMirrorEmotion ? "是" : "否"}`,
    `- 路线指导：${route.routeGuidance}`,
    "请把情绪路由作为回复策略：控制长度、语气和是否给建议，不要在回复中暴露这些标签。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function getReplyPolicySystemInstruction(
  replyPolicy: ReplyPolicy | null,
) {
  if (!replyPolicy) {
    return "";
  }

  return [
    "本轮回复策略：",
    `- 策略：${replyPolicy.policy}`,
    `- 句数范围：${replyPolicy.sentenceBudget.min} 到 ${replyPolicy.sentenceBudget.max} 句`,
    `- 节奏：${replyPolicy.rhythm}`,
    `- 开场动作：${replyPolicy.openingMove}`,
    `- 亲密度：${replyPolicy.intimacyLevel}`,
    `- 追问上限：${replyPolicy.questionLimit}`,
    `- 建议上限：${replyPolicy.adviceLimit}`,
    replyPolicy.allowedMoves.length > 0
      ? `- 允许动作：${replyPolicy.allowedMoves.join("、")}`
      : "",
    replyPolicy.forbiddenMoves.length > 0
      ? `- 禁止动作：${replyPolicy.forbiddenMoves.join("、")}`
      : "",
    `- 风格指导：${replyPolicy.styleGuidance}`,
    "这不是固定话术模板；请自然表达，但必须遵守以上策略约束，不要暴露策略名称或内部标签。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function getRelationshipStageSystemInstruction(
  relationshipStage: ConversationRelationshipStage | null,
) {
  if (!relationshipStage) {
    return "";
  }

  return [
    "本轮关系阶段：",
    `- 阶段：${relationshipStage.displayName}（${relationshipStage.stage}）`,
    `- 亲近度：${relationshipStage.closenessScore}/100`,
    `- 信任等级：${relationshipStage.trustLevel}`,
    `- 稳定性：${relationshipStage.stability}`,
    `- 边界模式：${relationshipStage.boundaryMode}`,
    `- 允许亲密度：${relationshipStage.intimacyPermission}`,
    `- 推进节奏：${relationshipStage.pacing}`,
    relationshipStage.riskSignals.length > 0
      ? `- 风险信号：${relationshipStage.riskSignals.join("、")}`
      : "",
    `- 关系指导：${relationshipStage.relationshipGuidance}`,
    "请把关系阶段作为隐性节奏控制：不要在回复中暴露阶段名称、分数或内部标签。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildConversationAnalysisMetadata(params: {
  safety: ConversationSafety;
  intent: ConversationIntent | null;
  emotion: ConversationEmotion | null;
  relationshipStage: ConversationRelationshipStage | null;
  route: EmotionRoute | null;
  replyPolicy: ReplyPolicy | null;
}) {
  return JSON.stringify({
    analysisVersion: "conversation-understanding-v3",
    safety: params.safety,
    intent: params.intent,
    emotion: params.emotion,
    relationshipStage: params.relationshipStage,
    route: params.route,
    replyPolicy: params.replyPolicy,
  });
}

const fallbackReplyQualityGuard: ReplyQualityGuard = {
  status: "pass",
  score: 1,
  sentenceCount: 0,
  questionCount: 0,
  adviceCount: 0,
  violations: [],
};

const advicePatterns: RegExp[] = [
  /建议你/g,
  /你可以/g,
  /不妨/g,
  /最好/g,
  /应该/g,
  /试着/g,
  /尝试/g,
  /可以先/g,
];

type ReplyGuardViolation = ReplyQualityGuard["violations"][number];

function countReplySentences(text: string) {
  const segments = text
    .split(/[。！？!?…\n]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  return Math.max(1, segments.length);
}

function countPatternMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((total, pattern) => {
    const matches = text.match(pattern);
    return total + (matches ? matches.length : 0);
  }, 0);
}

function addReplyGuardViolation(
  violations: ReplyGuardViolation[],
  violation: ReplyGuardViolation,
) {
  violations.push({
    code: violation.code,
    severity: violation.severity,
    evidence: violation.evidence.slice(0, 160),
  });
}

const INTERNAL_LABEL_KEYWORDS = [
  "intent",
  "emotion",
  "route",
  "policy",
  "safety",
  "replyPolicy",
  "意图判断",
  "情绪路由",
  "回复策略",
  "metadata",
];

const IMMERSION_BREAK_KEYWORDS = [
  "作为一个 AI",
  "作为一个AI",
  "我只是 AI",
  "我只是AI",
  "我是语言模型",
  "我没有真实情感",
  "我没有身体",
];

const FORBIDDEN_MOVE_CLUES: Partial<
  Record<
    ReplyPolicy["forbiddenMoves"][number],
    {
      code: ReplyGuardViolation["code"];
      keywords: string[];
    }
  >
> = {
  lecture: {
    code: "forbidden_lecture",
    keywords: ["你要明白", "你必须", "正确的做法是", "你应该要"],
  },
  over_explain: {
    code: "forbidden_over_explain",
    keywords: ["之所以", "原因是", "具体来说"],
  },
  intense_flirt: {
    code: "forbidden_intense_flirt",
    keywords: ["想你", "爱你", "亲亲", "抱紧", "宝贝"],
  },
  diagnose_user: {
    code: "forbidden_diagnosis",
    keywords: ["你这是", "你有点", "你可能得了", "焦虑症", "抑郁症"],
  },
  take_sides_aggressively: {
    code: "forbidden_aggressive_siding",
    keywords: ["他就是", "绝对是对方的错", "你没错都是他"],
  },
  pressure_to_disclose: {
    code: "forbidden_pressure",
    keywords: ["你倒是说啊", "到底怎么了", "必须告诉我"],
  },
  promise_real_world_action: {
    code: "forbidden_real_world_promise",
    keywords: ["我帮你去", "我会到", "我明天见你", "我打电话给"],
  },
};

function firstMatchedKeyword(text: string, keywords: string[]) {
  return keywords.find((keyword) => text.includes(keyword)) ?? null;
}

export function evaluateReplyQuality(params: {
  assistantText: string;
  replyPolicy: ReplyPolicy | null;
}): ReplyQualityGuard {
  const text = normalizeStoredMessage(params.assistantText);

  if (!text) {
    return { ...fallbackReplyQualityGuard, violations: [] };
  }

  const replyPolicy = params.replyPolicy ?? fallbackReplyPolicy;
  const sentenceCount = countReplySentences(text);
  const questionCount = countPatternMatches(text, [/？/g, /\?/g]);
  const adviceCount = countPatternMatches(text, advicePatterns);

  const violations: ReplyGuardViolation[] = [];

  if (sentenceCount > replyPolicy.sentenceBudget.max) {
    const severity: ReplyGuardViolation["severity"] =
      sentenceCount > replyPolicy.sentenceBudget.max + 2 ? "high" : "medium";
    addReplyGuardViolation(violations, {
      code: "too_many_sentences",
      severity,
      evidence: `回复 ${sentenceCount} 句，超过策略上限 ${replyPolicy.sentenceBudget.max} 句。`,
    });
  }

  if (questionCount > replyPolicy.questionLimit) {
    addReplyGuardViolation(violations, {
      code: "too_many_questions",
      severity: "medium",
      evidence: `回复含 ${questionCount} 个问句，超过上限 ${replyPolicy.questionLimit}。`,
    });
  }

  if (adviceCount > replyPolicy.adviceLimit) {
    addReplyGuardViolation(violations, {
      code: "too_many_suggestions",
      severity: "medium",
      evidence: `回复含 ${adviceCount} 处建议型表达，超过上限 ${replyPolicy.adviceLimit}。`,
    });
  }

  const leakedLabel = firstMatchedKeyword(text, INTERNAL_LABEL_KEYWORDS);
  if (leakedLabel) {
    addReplyGuardViolation(violations, {
      code: "internal_label_leak",
      severity: "high",
      evidence: `命中内部标签词：${leakedLabel}。`,
    });
  }

  const immersionBreak = firstMatchedKeyword(text, IMMERSION_BREAK_KEYWORDS);
  if (immersionBreak) {
    addReplyGuardViolation(violations, {
      code: "breaks_immersion",
      severity: "high",
      evidence: `命中破坏沉浸感句式：${immersionBreak}。`,
    });
  }

  for (const move of replyPolicy.forbiddenMoves) {
    const clue = FORBIDDEN_MOVE_CLUES[move];
    if (!clue) {
      continue;
    }

    const matched = firstMatchedKeyword(text, clue.keywords);
    if (matched) {
      addReplyGuardViolation(violations, {
        code: clue.code,
        severity: "medium",
        evidence: `命中禁止动作 ${move} 线索：${matched}。`,
      });
    }
  }

  if (
    replyPolicy.forbiddenMoves.includes("premature_advice") &&
    adviceCount > 0
  ) {
    addReplyGuardViolation(violations, {
      code: "forbidden_premature_advice",
      severity: "medium",
      evidence: `策略禁止过早建议，回复出现 ${adviceCount} 处建议型表达。`,
    });
  }

  const cappedViolations = violations.slice(0, 12);
  const highCount = cappedViolations.filter(
    (v) => v.severity === "high",
  ).length;
  const mediumCount = cappedViolations.filter(
    (v) => v.severity === "medium",
  ).length;
  const lowCount = cappedViolations.filter((v) => v.severity === "low").length;

  const score = Math.max(
    0,
    1 - highCount * 0.35 - mediumCount * 0.18 - lowCount * 0.08,
  );

  const status: ReplyQualityGuard["status"] =
    highCount > 0 || score < 0.5
      ? "fail"
      : cappedViolations.length > 0
        ? "warn"
        : "pass";

  return ReplyQualityGuardSchema.parse({
    status,
    score,
    sentenceCount,
    questionCount,
    adviceCount,
    violations: cappedViolations,
  });
}

export function toAssistantReplyQualityMetadata(params: {
  replyPolicy: ReplyPolicy | null;
  guard: ReplyQualityGuard;
}) {
  return JSON.stringify({
    analysisVersion: "reply-quality-guard-v1",
    replyPolicy: params.replyPolicy,
    guard: params.guard,
  });
}
