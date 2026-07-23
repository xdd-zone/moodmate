import {
  ConversationIntentSchema,
  ConversationSafetySchema,
  type ConversationIntent,
  type ConversationSafety,
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

const ConversationUnderstandingState = Annotation.Root({
  providerConfig: Annotation<ChatProviderConfig>(),
  safety: Annotation<ConversationSafety>(),
  activeMemories: Annotation<AnalysisMemory[]>(),
  recentMessages: Annotation<AnalysisRecentMessage[]>(),
  userText: Annotation<string>(),
  normalizedInput: Annotation<string>(),
  intent: Annotation<ConversationIntent | null>(),
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

const conversationIntentGraph = new StateGraph(ConversationUnderstandingState)
  .addNode("normalizeInput", normalizeIntentInputNode)
  .addNode("classifyIntent", classifyIntentNode)
  .addEdge(START, "normalizeInput")
  .addEdge("normalizeInput", "classifyIntent")
  .addEdge("classifyIntent", END)
  .compile();

export async function analyzeConversationIntent(params: {
  providerConfig: ChatProviderConfig;
  safety: ConversationSafety;
  activeMemories: AnalysisMemory[];
  recentMessages: AnalysisRecentMessage[];
  userText: string;
  signal: AbortSignal;
}): Promise<ConversationIntent> {
  try {
    const result = await conversationIntentGraph.invoke(
      {
        providerConfig: params.providerConfig,
        safety: params.safety,
        activeMemories: params.activeMemories,
        recentMessages: params.recentMessages,
        userText: params.userText,
        normalizedInput: "",
        intent: null,
        signal: params.signal,
      },
      { signal: params.signal },
    );

    return (
      result.intent ??
      normalizeConversationIntent(fallbackIntent, params.safety)
    );
  } catch (error) {
    console.warn("LangGraph conversation intent analysis failed", error);
    return normalizeConversationIntent(fallbackIntent, params.safety);
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

export function buildConversationAnalysisMetadata(params: {
  safety: ConversationSafety;
  intent: ConversationIntent | null;
}) {
  return JSON.stringify({
    analysisVersion: "conversation-analysis-v1",
    safety: params.safety,
    intent: params.intent,
  });
}
