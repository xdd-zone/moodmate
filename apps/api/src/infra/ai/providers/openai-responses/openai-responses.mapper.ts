import type {
  FunctionTool,
  Response,
  ResponseCreateParamsBase,
  ResponseInput,
  ResponseStatus,
  ResponseTextConfig,
  ResponseUsage,
  ToolChoiceFunction,
} from "openai/resources/responses/responses";

import type {
  AiAssistantMessage,
  AiFinishReason,
  AiMessage,
  AiResponseFormat,
  AiToolDefinition,
  AiUsage,
} from "../../types";

/** 内部消息转 OpenAI Responses input items。 */
export function toResponsesInput(messages: AiMessage[]): ResponseInput {
  const input: ResponseInput = [];

  for (const message of messages) {
    switch (message.role) {
      case "system":
        input.push({ role: "developer", content: message.content });
        break;
      case "user":
        input.push({ role: "user", content: message.content });
        break;
      case "assistant":
        if (message.content) {
          input.push({ role: "assistant", content: message.content });
        }
        for (const toolCall of message.toolCalls ?? []) {
          input.push({
            type: "function_call",
            call_id: toolCall.id,
            name: toolCall.name,
            arguments: toolCall.arguments,
          });
        }
        break;
      case "tool":
        input.push({
          type: "function_call_output",
          call_id: message.toolCallId,
          output: message.content,
        });
        break;
    }
  }

  return input;
}

/** 内部工具声明转 Responses function tool。 */
export function toResponsesTools(tools: AiToolDefinition[]): FunctionTool[] {
  return tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: true,
  }));
}

export interface ResponsesStructuredOutputParts {
  text?: ResponseTextConfig;
  tools?: FunctionTool[];
  toolChoice?: ToolChoiceFunction;
}

export function toResponsesStructuredOutputParts(
  format: AiResponseFormat,
): ResponsesStructuredOutputParts {
  switch (format.method) {
    case "json_schema":
      return {
        text: {
          format: {
            type: "json_schema",
            name: format.name,
            schema: format.jsonSchema,
            strict: true,
          },
        },
      };
    case "json_object":
      return { text: { format: { type: "json_object" } } };
    case "function":
      return {
        tools: toResponsesTools([
          {
            name: format.name,
            description: `生成 ${format.name} 结构化结果`,
            parameters: format.jsonSchema,
          },
        ]),
        toolChoice: { type: "function", name: format.name },
      };
  }
}

/** Responses 非流式响应转内部 assistant 消息。 */
export function toResponsesAssistantMessage(
  response: Response,
): AiAssistantMessage {
  const text: string[] = [];
  const toolCalls: NonNullable<AiAssistantMessage["toolCalls"]> = [];

  for (const item of response.output) {
    if (item.type === "message") {
      for (const content of item.content) {
        if (content.type === "output_text") {
          text.push(content.text);
        } else if (content.type === "refusal") {
          text.push(content.refusal);
        }
      }
    } else if (item.type === "function_call") {
      toolCalls.push({
        id: item.call_id,
        name: item.name,
        arguments: item.arguments,
      });
    }
  }

  return {
    role: "assistant",
    content: text.join(""),
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
  };
}

export function mapResponsesFinishReason(
  status: ResponseStatus | undefined,
  hasToolCalls: boolean,
): AiFinishReason {
  if (hasToolCalls && status === "completed") {
    return "tool-calls";
  }

  switch (status) {
    case "completed":
      return "stop";
    case "incomplete":
      return "length";
    case "failed":
    case "cancelled":
      return "error";
    default:
      return "unknown";
  }
}

export function mapResponsesUsage(
  usage: ResponseUsage | null | undefined,
): AiUsage | null {
  if (!usage) {
    return null;
  }

  return {
    promptTokens: usage.input_tokens,
    completionTokens: usage.output_tokens,
    totalTokens: usage.total_tokens,
  };
}

/** 构造 Responses 请求的协议公共部分。 */
export function toResponsesRequestParts(request: {
  messages: AiMessage[];
  tools?: AiToolDefinition[];
  responseFormat?: AiResponseFormat;
}): Pick<ResponseCreateParamsBase, "input" | "text" | "tool_choice" | "tools"> {
  const structured = request.responseFormat
    ? toResponsesStructuredOutputParts(request.responseFormat)
    : undefined;
  const tools =
    structured?.tools ??
    (request.tools && request.tools.length > 0
      ? toResponsesTools(request.tools)
      : undefined);

  return {
    input: toResponsesInput(request.messages),
    ...(structured?.text ? { text: structured.text } : {}),
    ...(structured?.toolChoice ? { tool_choice: structured.toolChoice } : {}),
    ...(tools ? { tools } : {}),
  };
}
