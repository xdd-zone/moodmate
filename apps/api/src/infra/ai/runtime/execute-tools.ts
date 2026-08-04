/**
 * 工具执行循环。
 *
 * 业务在每次生成调用时显式传入本轮工具（不使用全局可变注册表）。runtime 把工具
 * 声明转成 JSON Schema 交给 Provider，Provider 返回一个或多个工具调用后，runtime
 * 按返回顺序查找工具、用 Zod 校验参数、顺序执行，再把结果交回模型继续生成。
 *
 * 约束：
 * - 未注册工具、参数无效、执行异常都转成规范化 tool result，让模型有机会修正。
 * - AbortSignal 同时中止模型请求和尚未开始的工具执行；取消直接向上抛 `aborted`，
 *   不包装成 tool result。
 * - 默认最多 5 轮模型调用；达到上限仍只有工具调用时返回 `max_steps`。
 * - 工具日志只记录名称、耗时和结果状态，不记录完整参数与返回值。
 */

import { z } from "zod";

import { AiError } from "../errors";
import type {
  AiGenerationOptions,
  AiGenerationResult,
  AiMessage,
  AiModel,
  AiProvider,
  AiTool,
  AiToolCall,
  AiToolContext,
  AiToolDefinition,
  AiToolResultMessage,
  AiCallObserver,
} from "../types";

const DEFAULT_MAX_STEPS = 5;

/** 工具结果状态，仅用于日志，不含参数与返回值。 */
type ToolResultStatus = "ok" | "not_found" | "invalid_arguments" | "error";

export interface ToolCallingLoopParams {
  provider: AiProvider;
  model: AiModel;
  messages: AiMessage[];
  tools: AiTool[];
  generationOptions: AiGenerationOptions;
  /** 默认 5 轮模型调用。 */
  maxSteps?: number;
  observer?: AiCallObserver;
}

/**
 * 运行工具执行循环，返回最终 assistant 结果。
 *
 * 每轮：先判断取消，再调 Provider；若结果不含工具调用则视为最终答案返回；
 * 否则把 assistant 工具调用与顺序执行得到的 tool result 追加进消息，进入下一轮。
 */
export async function runToolCallingLoop(
  params: ToolCallingLoopParams,
): Promise<AiGenerationResult> {
  const maxSteps = params.maxSteps ?? DEFAULT_MAX_STEPS;
  const signal = params.generationOptions.signal;
  const toolMap = new Map(params.tools.map((tool) => [tool.name, tool]));
  const toolDefinitions = toToolDefinitions(params.tools);
  const messages: AiMessage[] = [...params.messages];

  for (let step = 0; step < maxSteps; step += 1) {
    throwIfAborted(signal);

    const callId = await params.observer?.onStart({
      structuredOutputMethod: null,
    });
    let result: AiGenerationResult;
    try {
      result = await params.provider.generate({
        model: params.model,
        messages,
        options: params.generationOptions,
        tools: toolDefinitions,
      });
      if (callId) await params.observer?.onComplete(callId, result);
    } catch (error) {
      if (callId) await params.observer?.onError(callId, error);
      throw error;
    }

    const toolCalls = result.message.toolCalls ?? [];

    if (toolCalls.length === 0) {
      return result;
    }

    // 追加本轮 assistant 的工具调用，再顺序执行每个工具。
    messages.push(result.message);

    for (const toolCall of toolCalls) {
      throwIfAborted(signal);
      const toolResult = await executeToolCall(toolCall, toolMap, { signal });
      messages.push(toolResult);
    }
  }

  throw new AiError("max_steps", `工具调用超过最大轮数 ${maxSteps}`, {
    metadata: {
      providerName: params.model.providerName,
      model: params.model.model,
    },
  });
}

/** 内部工具定义转 Provider 声明，参数用 JSON Schema 表达。 */
function toToolDefinitions(tools: AiTool[]): AiToolDefinition[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: z.toJSONSchema(tool.inputSchema) as Record<string, unknown>,
  }));
}

/**
 * 执行单个工具调用。未注册 / 参数无效 / 执行失败都返回失败 tool result；
 * 命中取消则抛 `aborted`，不落 tool result。
 */
async function executeToolCall(
  toolCall: AiToolCall,
  toolMap: Map<string, AiTool>,
  context: AiToolContext,
): Promise<AiToolResultMessage> {
  const startedAt = Date.now();
  const tool = toolMap.get(toolCall.name);

  if (!tool) {
    logToolResult(toolCall.name, Date.now() - startedAt, "not_found");
    return buildToolResult(toolCall, `工具 ${toolCall.name} 未注册`);
  }

  let rawArguments: unknown;

  try {
    rawArguments = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
  } catch {
    logToolResult(toolCall.name, Date.now() - startedAt, "invalid_arguments");
    return buildToolResult(toolCall, "工具参数不是有效 JSON");
  }

  const parsed = tool.inputSchema.safeParse(rawArguments);

  if (!parsed.success) {
    logToolResult(toolCall.name, Date.now() - startedAt, "invalid_arguments");
    return buildToolResult(toolCall, "工具参数未通过校验");
  }

  try {
    const output = await tool.execute(parsed.data, context);
    logToolResult(toolCall.name, Date.now() - startedAt, "ok");
    return buildToolResult(toolCall, output);
  } catch (error) {
    // 用户取消不当作工具失败，向上抛保持取消语义。
    if (context.signal?.aborted) {
      throw new AiError("aborted", "请求已取消", { cause: error });
    }

    logToolResult(toolCall.name, Date.now() - startedAt, "error");
    return buildToolResult(toolCall, "工具执行失败");
  }
}

function buildToolResult(
  toolCall: AiToolCall,
  content: string,
): AiToolResultMessage {
  return {
    role: "tool",
    toolCallId: toolCall.id,
    name: toolCall.name,
    content,
  };
}

function logToolResult(
  name: string,
  durationMs: number,
  status: ToolResultStatus,
): void {
  console.info("AI 工具执行", { name, durationMs, status });
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new AiError("aborted", "请求已取消");
  }
}
