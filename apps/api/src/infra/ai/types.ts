import type { z } from "zod";

import type { AiError } from "./errors";

/**
 * AI 模块内部类型定义。
 *
 * 描述模型请求与结果的规范化形状。业务层（chat / group-chat / LangGraph 节点）
 * 只使用这里的类型，不构造具体 SDK 类型；只有对应的 providers/* 目录
 * 可以在边界把这些内部类型转换为上游协议类型。
 */

// ---------------------------------------------------------------------------
// Protocol and model connection
// ---------------------------------------------------------------------------

/** 协议标识。registry 以此为 key 选择实现。 */
export type AiApi =
  | "openai-chat-completions"
  | "anthropic-messages"
  | "openai-responses";

/** 各协议特有的、受控的 Provider 选项。 */
export interface AiProviderOptions {
  "openai-chat-completions"?: {
    /** 关闭上游推理过程（映射为当前上游接受的请求扩展字段）。 */
    disableThinking?: boolean;
  };
}

/**
 * 模型连接数据。由 llm-config 构造后传入 AI 模块。
 *
 * `providerName` 仅用于日志和管理端识别，不参与实现选择；`api` 才是 registry key。
 * `apiKey` 只存在于请求期内存，不进入事件、错误 metadata 或持久化日志。
 */
export interface AiModel {
  api: AiApi;
  providerName: string;
  model: string;
  baseURL: string;
  apiKey: string;
  providerOptions?: AiProviderOptions;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** assistant 发起的一次工具调用。 */
export interface AiToolCall {
  id: string;
  name: string;
  /** 工具参数的原始 JSON 文本，进入 runtime 后再解析为 unknown 并交 Zod 校验。 */
  arguments: string;
}

export interface AiSystemMessage {
  role: "system";
  content: string;
}

export interface AiUserMessage {
  role: "user";
  content: string;
}

export interface AiAssistantMessage {
  role: "assistant";
  content: string;
  toolCalls?: AiToolCall[];
}

export interface AiToolResultMessage {
  role: "tool";
  toolCallId: string;
  name: string;
  content: string;
}

/** 规范化消息，覆盖文本、assistant tool call 和 tool result。 */
export type AiMessage =
  | AiSystemMessage
  | AiUserMessage
  | AiAssistantMessage
  | AiToolResultMessage;

// ---------------------------------------------------------------------------
// Usage, finish reason, results
// ---------------------------------------------------------------------------

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** runtime 会处理的稳定 finish reason；原始 SDK 值在 Provider 边界映射。 */
export type AiFinishReason =
  | "stop"
  | "length"
  | "tool-calls"
  | "content-filter"
  | "error"
  | "unknown";

export interface AiGenerationResult {
  message: AiAssistantMessage;
  usage: AiUsage | null;
  finishReason: AiFinishReason;
}

// ---------------------------------------------------------------------------
// Generation options
// ---------------------------------------------------------------------------

/** 统一生成参数。Provider 特有选项通过 AiModel.providerOptions 传递。 */
export interface AiGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * structured output 请求的响应格式描述。
 * runtime 把 Zod schema 转成 JSON Schema 后填入，Provider 只依赖 JSON Schema。
 */
export interface AiResponseFormat {
  name: string;
  /** 由 Zod 转换得到的 JSON Schema。Provider 不依赖 Zod。 */
  jsonSchema: Record<string, unknown>;
  /** structured output 兼容方法，Provider 按顺序尝试。 */
  method: AiStructuredOutputMethod;
}

/** runtime 统一尝试的 structured output 方法。 */
export type AiStructuredOutputMethod =
  | "json_schema"
  | "function"
  | "json_object";

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/**
 * 工具执行上下文。只含调用方显式提供的业务能力和取消信号，
 * 不暴露 Hono context 或可变 registry。
 */
export interface AiToolContext {
  signal?: AbortSignal;
}

/**
 * 工具定义。业务在每次生成调用时显式传入，不使用全局可变注册表。
 * 参数使用 Zod schema，执行前必须校验。
 */
export interface AiTool<TInput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute(input: TInput, context: AiToolContext): Promise<string> | string;
}

/** Provider 收到的工具声明，只含 JSON Schema，不含 execute。 */
export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Stream events
// ---------------------------------------------------------------------------

export interface AiStreamStartEvent {
  type: "start";
}

export interface AiStreamTextDeltaEvent {
  type: "text-delta";
  delta: string;
}

/** 工具调用参数的流式增量，按 tool call id/index 合并。 */
export interface AiStreamToolCallDeltaEvent {
  type: "tool-call-delta";
  index: number;
  id?: string;
  name?: string;
  argumentsDelta?: string;
}

/** 合并完成的一次工具调用。 */
export interface AiStreamToolCallEvent {
  type: "tool-call";
  toolCall: AiToolCall;
}

export interface AiStreamUsageEvent {
  type: "usage";
  usage: AiUsage;
}

export interface AiStreamFinishEvent {
  type: "finish";
  finishReason: AiFinishReason;
  usage: AiUsage | null;
}

export interface AiStreamErrorEvent {
  type: "error";
  error: AiError;
}

export type AiStreamEvent =
  | AiStreamStartEvent
  | AiStreamTextDeltaEvent
  | AiStreamToolCallDeltaEvent
  | AiStreamToolCallEvent
  | AiStreamUsageEvent
  | AiStreamFinishEvent
  | AiStreamErrorEvent;

/** 可异步迭代的内部事件流。runtime 组合工具循环并在测试中逐项断言。 */
export type AiEventStream = AsyncIterable<AiStreamEvent>;

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

/** Provider 收到的规范化请求，由 registry 按 api 匹配后调用。 */
export interface AiProviderRequest {
  model: AiModel;
  messages: AiMessage[];
  options?: AiGenerationOptions;
  tools?: AiToolDefinition[];
  responseFormat?: AiResponseFormat;
}

export interface AiProvider<TApi extends AiApi = AiApi> {
  readonly api: TApi;
  generate(request: AiProviderRequest): Promise<AiGenerationResult>;
  stream(request: AiProviderRequest): AiEventStream;
}
