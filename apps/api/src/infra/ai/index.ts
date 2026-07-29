/**
 * AI 模块公开入口。业务模块（chat / group-chat / llm-config / LangGraph 节点）
 * 只从这里 import 类型与 runtime API，不深入子文件，也不直接依赖 openai SDK。
 *
 * runtime API 是业务模块调用模型的唯一入口：`generateText` / `streamText`
 * 处理文本生成，`generateObject` 处理结构化输出。业务只从这里 import。
 */

export { AiError, isAiError } from "./errors";
export type { AiErrorCode, AiErrorMetadata, AiErrorOptions } from "./errors";

export type {
  AiApi,
  AiProviderOptions,
  AiModel,
  AiToolCall,
  AiSystemMessage,
  AiUserMessage,
  AiAssistantMessage,
  AiToolResultMessage,
  AiMessage,
  AiUsage,
  AiFinishReason,
  AiGenerationResult,
  AiGenerationOptions,
  AiResponseFormat,
  AiStructuredOutputMethod,
  AiToolContext,
  AiTool,
  AiToolDefinition,
  AiStreamStartEvent,
  AiStreamTextDeltaEvent,
  AiStreamToolCallDeltaEvent,
  AiStreamToolCallEvent,
  AiStreamUsageEvent,
  AiStreamFinishEvent,
  AiStreamErrorEvent,
  AiStreamEvent,
  AiEventStream,
  AiProviderRequest,
  AiProvider,
} from "./types";

export { toTextByteStream, toEventStream, collectEvents } from "./stream";
export type { TextStreamAdapterOptions } from "./stream";

export { generateText, streamText } from "./runtime/generate-text";
export type {
  GenerateTextOptions,
  StreamTextOptions,
} from "./runtime/generate-text";

export { generateObject } from "./runtime/generate-object";
export type {
  GenerateObjectOptions,
  GenerateObjectResult,
} from "./runtime/generate-object";
