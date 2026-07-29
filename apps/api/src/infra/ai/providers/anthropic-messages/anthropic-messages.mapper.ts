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
} from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  Message,
  MessageParam,
  StopReason,
  Tool,
  Usage,
} from "@anthropic-ai/sdk/resources/messages";

import { AiError } from "../../errors";
import type { AiErrorCode, AiErrorMetadata } from "../../errors";
import type {
  AiAssistantMessage,
  AiFinishReason,
  AiMessage,
  AiToolDefinition,
  AiUsage,
} from "../../types";

export interface AnthropicMessagesInput {
  messages: MessageParam[];
  system?: string;
}

/** 内部消息转 Anthropic Messages 参数。 */
export function toAnthropicMessages(
  messages: AiMessage[],
): AnthropicMessagesInput {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n");
  const result: MessageParam[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];

    switch (message.role) {
      case "system":
        break;
      case "user":
        result.push({ role: "user", content: message.content });
        break;
      case "assistant": {
        const content: ContentBlockParam[] = [];

        if (message.content) {
          content.push({ type: "text", text: message.content });
        }

        for (const toolCall of message.toolCalls ?? []) {
          content.push({
            type: "tool_use",
            id: toolCall.id,
            name: toolCall.name,
            input: parseToolArguments(toolCall.arguments),
          });
        }

        if (content.length > 0) {
          result.push({ role: "assistant", content });
        }
        break;
      }
      case "tool": {
        const content: ContentBlockParam[] = [];
        let cursor = index;

        while (cursor < messages.length) {
          const toolResult = messages[cursor];

          if (toolResult.role !== "tool") {
            break;
          }

          content.push({
            type: "tool_result",
            tool_use_id: toolResult.toolCallId,
            content: toolResult.content,
          });
          cursor += 1;
        }

        result.push({ role: "user", content });
        index = cursor - 1;
        break;
      }
    }
  }

  return {
    messages: result,
    ...(system ? { system } : {}),
  };
}

/** 内部工具声明转 Anthropic client tool。 */
export function toAnthropicTools(tools: AiToolDefinition[]): Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      ...tool.parameters,
      type: "object",
    },
  }));
}

/** Anthropic 非流式消息转内部生成结果。 */
export function toAnthropicAssistantMessage(
  message: Message,
): AiAssistantMessage {
  const text: string[] = [];
  const toolCalls: NonNullable<AiAssistantMessage["toolCalls"]> = [];

  for (const block of message.content) {
    if (block.type === "text") {
      text.push(block.text);
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: stringifyToolArguments(block.input),
      });
    }
  }

  return {
    role: "assistant",
    content: text.join(""),
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
  };
}

export function mapAnthropicFinishReason(
  reason: StopReason | null,
): AiFinishReason {
  switch (reason) {
    case "end_turn":
    case "stop_sequence":
    case "pause_turn":
      return "stop";
    case "max_tokens":
      return "length";
    case "tool_use":
      return "tool-calls";
    case "refusal":
      return "content-filter";
    default:
      return "unknown";
  }
}

export function mapAnthropicUsage(usage: Usage): AiUsage {
  const promptTokens =
    usage.input_tokens +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0);

  return {
    promptTokens,
    completionTokens: usage.output_tokens,
    totalTokens: promptTokens + usage.output_tokens,
  };
}

interface AnthropicErrorContext {
  signal?: AbortSignal;
  providerName: string;
  model: string;
  durationMs: number;
}

/** Anthropic SDK error 转为 AI runtime 的稳定错误。 */
export function mapAnthropicSdkError(
  error: unknown,
  context: AnthropicErrorContext,
): AiError {
  const baseMetadata: AiErrorMetadata = {
    providerName: context.providerName,
    model: context.model,
    durationMs: context.durationMs,
  };

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
    const { code, message } = classifyAnthropicApiError(error);

    return new AiError(code, message, { metadata, cause: error });
  }

  return new AiError("upstream_error", "模型服务返回未知错误", {
    metadata: baseMetadata,
    cause: error,
  });
}

function parseToolArguments(value: string): unknown {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed;
  } catch {
    return {};
  }
}

export function stringifyToolArguments(value: unknown): string {
  return JSON.stringify(value) ?? "{}";
}

function classifyAnthropicApiError(error: APIError): {
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

  if (
    error instanceof BadRequestError ||
    error instanceof UnprocessableEntityError
  ) {
    return { code: "invalid_response", message: "模型服务无法处理该请求" };
  }

  return { code: "upstream_error", message: "模型服务返回错误" };
}
