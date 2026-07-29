/**
 * OpenAI-compatible 协议的边界转换。
 *
 * 这里是唯一允许引用 `openai` SDK 类型的位置之一（另一处是 provider 文件）。
 * 所有导出函数只接收或返回 MoodMate 内部类型与 SDK 类型之间的转换结果；
 * SDK 类型不会通过目录 `index.ts` 对外导出。
 */

import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption,
  ChatCompletionCreateParamsBase,
} from "openai/resources/chat/completions";
import type { CompletionUsage } from "openai/resources/completions";

import { AiError } from "../../errors";
import type { AiErrorCode, AiErrorMetadata } from "../../errors";
import type {
  AiAssistantMessage,
  AiFinishReason,
  AiMessage,
  AiResponseFormat,
  AiToolCall,
  AiToolDefinition,
  AiUsage,
} from "../../types";

/** 上游 chat completion 的 finish_reason（非流式与流式共用同一集合）。 */
type SdkFinishReason =
  | "stop"
  | "length"
  | "tool_calls"
  | "content_filter"
  | "function_call"
  | null
  | undefined;

/**
 * 内部消息转 OpenAI ChatCompletion 消息参数。
 * 业务层只构造 AiMessage，不接触 SDK 参数类型。
 */
export function toChatMessages(
  messages: AiMessage[],
): ChatCompletionMessageParam[] {
  return messages.map((message): ChatCompletionMessageParam => {
    switch (message.role) {
      case "system":
        return { role: "system", content: message.content };
      case "user":
        return { role: "user", content: message.content };
      case "assistant":
        return {
          role: "assistant",
          content: message.content,
          ...(message.toolCalls && message.toolCalls.length > 0
            ? {
                tool_calls: message.toolCalls.map((toolCall) => ({
                  id: toolCall.id,
                  type: "function" as const,
                  function: {
                    name: toolCall.name,
                    arguments: toolCall.arguments,
                  },
                })),
              }
            : {}),
        };
      case "tool":
        return {
          role: "tool",
          tool_call_id: message.toolCallId,
          content: message.content,
        };
    }
  });
}

/** 内部工具声明转 OpenAI function tool。只包含 JSON Schema，不含 execute。 */
export function toChatTools(tools: AiToolDefinition[]): ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/** structured output 请求在 SDK 请求体上的增量部分。 */
export interface StructuredOutputParts {
  responseFormat?: ChatCompletionCreateParamsBase["response_format"];
  tools?: ChatCompletionTool[];
  toolChoice?: ChatCompletionToolChoiceOption;
}

/**
 * 按 responseFormat.method 生成 SDK 请求增量。
 *
 * - `json_schema`：走 `response_format: json_schema`，结果对象在 message.content。
 * - `json_object`：走 `response_format: json_object`，结果对象在 message.content。
 * - `function`：注册单个 function tool 并强制 tool_choice，结果对象在 tool_call.arguments。
 *
 * 只依赖 JSON Schema，不依赖 Zod。方法切换由 runtime（阶段 4）按错误码决定，
 * provider 只忠实应用当前 method。
 */
export function toStructuredOutputParts(
  format: AiResponseFormat,
): StructuredOutputParts {
  switch (format.method) {
    case "json_schema":
      return {
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: format.name,
            schema: format.jsonSchema,
            strict: true,
          },
        },
      };
    case "json_object":
      return {
        responseFormat: { type: "json_object" },
      };
    case "function":
      return {
        tools: [
          {
            type: "function",
            function: {
              name: format.name,
              description: `生成 ${format.name} 结构化结果`,
              parameters: format.jsonSchema,
              strict: true,
            },
          },
        ],
        toolChoice: { type: "function", function: { name: format.name } },
      };
  }
}

/** 上游 finish_reason 映射为 runtime 稳定值。 */
export function mapFinishReason(reason: SdkFinishReason): AiFinishReason {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "tool_calls":
    case "function_call":
      return "tool-calls";
    case "content_filter":
      return "content-filter";
    default:
      return "unknown";
  }
}

/** SDK usage 映射为内部 usage；缺失时返回 null。 */
export function mapUsage(
  usage: CompletionUsage | null | undefined,
): AiUsage | null {
  if (!usage) {
    return null;
  }

  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

/** 从非流式响应 message 中提取内部 assistant 消息（只保留 function tool call）。 */
export function toAssistantMessage(input: {
  content: string | null | undefined;
  toolCalls?: Array<{
    id: string;
    type: string;
    function?: { name: string; arguments: string };
  }>;
}): AiAssistantMessage {
  const toolCalls: AiToolCall[] = (input.toolCalls ?? [])
    .filter(
      (
        call,
      ): call is typeof call & {
        function: { name: string; arguments: string };
      } => call.type === "function" && call.function !== undefined,
    )
    .map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: call.function.arguments,
    }));

  return {
    role: "assistant",
    content: input.content ?? "",
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
  };
}

/**
 * SDK error 转 AiError。只保留可安全记录的 status / requestId，
 * 不写入 apiKey、Authorization、完整 prompt、完整工具参数或原始上游错误体。
 */
export function mapSdkError(
  error: unknown,
  context: {
    signal?: AbortSignal;
    providerName: string;
    model: string;
    durationMs: number;
  },
): AiError {
  const baseMetadata: AiErrorMetadata = {
    providerName: context.providerName,
    model: context.model,
    durationMs: context.durationMs,
  };

  // 用户主动取消优先判断：保持取消语义，不转成上游错误。
  if (context.signal?.aborted || error instanceof APIUserAbortError) {
    return new AiError("aborted", "请求已取消", {
      metadata: baseMetadata,
      cause: error,
    });
  }

  if (error instanceof APIConnectionTimeoutError) {
    return new AiError("timeout", "模型服务响应超时", {
      metadata: baseMetadata,
      cause: error,
    });
  }

  if (error instanceof APIConnectionError) {
    return new AiError("network", "无法连接模型服务", {
      metadata: baseMetadata,
      cause: error,
    });
  }

  if (error instanceof APIError) {
    const metadata: AiErrorMetadata = {
      ...baseMetadata,
      status: typeof error.status === "number" ? error.status : undefined,
      requestId: error.requestID ?? undefined,
    };

    const { code, message } = classifyApiError(error);
    return new AiError(code, message, { metadata, cause: error });
  }

  return new AiError("upstream_error", "模型服务返回未知错误", {
    metadata: baseMetadata,
    cause: error,
  });
}

function classifyApiError(error: APIError): {
  code: AiErrorCode;
  message: string;
} {
  if (error instanceof AuthenticationError) {
    return { code: "authentication", message: "模型服务认证失败" };
  }

  if (error instanceof PermissionDeniedError) {
    return { code: "permission_denied", message: "模型服务拒绝访问" };
  }

  if (error instanceof RateLimitError) {
    return { code: "rate_limited", message: "模型服务触发限流" };
  }

  // 400 / 422 通常意味着请求形状或 structured output 方法不被支持，
  // 交给 runtime 决定是否切换到下一种 structured output 方法。
  if (
    error instanceof BadRequestError ||
    error instanceof UnprocessableEntityError
  ) {
    return { code: "invalid_response", message: "模型服务无法处理该请求" };
  }

  return { code: "upstream_error", message: "模型服务返回错误" };
}
