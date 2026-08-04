/**
 * 结构化输出 runtime。
 *
 * `generateObject<T>()` 接受 Zod schema，转成 JSON Schema 后交给 Provider，
 * 按明确顺序尝试受支持的 structured output 方法，模型返回后再用原 Zod schema
 * 校验，无效结果统一返回 `invalid_output`。
 *
 * 约束：
 * - 只有明确的「structured output 方法不被支持」（Provider 把 400/422 映射为
 *   `invalid_response`）才切换下一种方法；认证、限流、超时、取消和网络错误
 *   不重复请求、不切换方法，直接向上抛。
 * - 只依赖 JSON Schema，不把 Zod 传给 Provider。
 * - runtime 不创建 AppError；`AiError` 向上传播由业务边界转换。
 */

import { z } from "zod";

import { AiError } from "../errors";
import { getAiProvider } from "../provider-registry";
import type {
  AiGenerationOptions,
  AiGenerationResult,
  AiMessage,
  AiModel,
  AiResponseFormat,
  AiStructuredOutputMethod,
  AiUsage,
  AiCallObserver,
} from "../types";

/**
 * structured output 方法按明确顺序尝试：
 * json_schema -> function tool -> json_object。
 */
const STRUCTURED_OUTPUT_METHODS: readonly AiStructuredOutputMethod[] = [
  "json_schema",
  "function",
  "json_object",
];

export interface GenerateObjectOptions<T> {
  model: AiModel;
  messages: AiMessage[];
  /** 用原 Zod schema 校验模型输出；同时转成 JSON Schema 交给 Provider。 */
  schema: z.ZodType<T>;
  /** structured output 结构名，用于 json_schema / function 方法命名。 */
  schemaName: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  observer?: AiCallObserver;
  /**
   * 限定本次尝试的 structured output 方法，按给定顺序降级。
   * 默认走 `STRUCTURED_OUTPUT_METHODS`；管理端能力检测用它单测某一种方法。
   */
  methods?: readonly AiStructuredOutputMethod[];
}

export interface GenerateObjectResult<T> {
  value: T;
  usage: AiUsage | null;
}

/**
 * 生成并校验结构化对象。
 *
 * 依次尝试受支持的 structured output 方法：
 * - `invalid_response`（方法不被支持）继续尝试下一种；
 * - `invalid_output`（模型输出无法过 Zod）继续尝试下一种，可能换方法能修好；
 * - 认证 / 限流 / 超时 / 取消 / 网络等错误立即向上抛，不重试、不切换。
 *
 * `json_object` 方法会额外注入含 json 字样与 JSON Schema 的系统消息，
 * 因为该方法本身不传 schema，且上游要求提示里出现 json 字样。
 *
 * 全部方法用尽后抛最后一次错误（无错误时抛 `invalid_output`）。
 */
export async function generateObject<T>(
  options: GenerateObjectOptions<T>,
): Promise<GenerateObjectResult<T>> {
  const provider = getAiProvider(options.model.api);
  const model = withThinkingDisabled(options.model);
  const jsonSchema = z.toJSONSchema(options.schema) as Record<string, unknown>;
  const generationOptions = toGenerationOptions(options);

  let lastError: AiError | null = null;

  for (const method of options.methods ?? STRUCTURED_OUTPUT_METHODS) {
    const responseFormat: AiResponseFormat = {
      name: options.schemaName,
      jsonSchema,
      method,
    };

    let result: AiGenerationResult;
    const callId = await options.observer?.onStart({
      structuredOutputMethod: method,
    });

    try {
      result = await provider.generate({
        model,
        messages:
          method === "json_object"
            ? withJsonObjectHint(options.messages, jsonSchema)
            : options.messages,
        options: generationOptions,
        responseFormat,
      });
    } catch (error) {
      if (callId) await options.observer?.onError(callId, error);
      if (!(error instanceof AiError)) {
        throw error;
      }

      // 只有「方法不被支持」才换方法；其余错误立即向上抛。
      if (error.code === "invalid_response") {
        // 已有模型输出但未通过 Zod 时，保留更具体的 invalid_output；
        // 后续协议能力不支持不应覆盖模型实际返回的无效结果。
        if (lastError?.code !== "invalid_output") {
          lastError = error;
        }
        continue;
      }

      throw error;
    }

    const rawText = extractStructuredText(result, method);
    const parsed = parseWithSchema(options.schema, rawText);

    if (parsed.ok) {
      if (callId) await options.observer?.onComplete(callId, result);
      return { value: parsed.value, usage: result.usage };
    }

    // 输出无法过 Zod：记录后尝试下一种方法。
    lastError = new AiError("invalid_output", "模型返回的结构化结果无法解析", {
      metadata: {
        providerName: options.model.providerName,
        model: options.model.model,
      },
    });
    if (callId) await options.observer?.onError(callId, lastError, result);
  }

  throw (
    lastError ??
    new AiError("invalid_output", "模型未能返回可用的结构化结果", {
      metadata: {
        providerName: options.model.providerName,
        model: options.model.model,
      },
    })
  );
}

/**
 * 结构化输出统一关闭上游推理模式。
 *
 * 推理与结构化输出在多数上游上冲突：推理过程会吃掉 `maxTokens` 预算导致 JSON
 * 截断，部分上游还直接拒绝推理模式下的 `tool_choice`。回复生成走
 * `generateText` / `streamText`，仍按模型配置保留推理。
 */
export function withThinkingDisabled(model: AiModel): AiModel {
  if (model.api === "openai-chat-completions") {
    return {
      ...model,
      providerOptions: {
        ...model.providerOptions,
        "openai-chat-completions": { disableThinking: true },
      },
    };
  }

  if (model.api === "openai-responses") {
    return {
      ...model,
      providerOptions: {
        ...model.providerOptions,
        "openai-responses": { disableThinking: true },
      },
    };
  }

  return model;
}

/**
 * json_object 方法只声明「输出 JSON」，不把 schema 交给 Provider。
 * OpenAI 及兼容实现都要求提示里出现 json 字样，否则直接返回 400，
 * 所以这里补一条系统消息，并把 JSON Schema 写进提示来约束结构。
 */
function withJsonObjectHint(
  messages: AiMessage[],
  jsonSchema: Record<string, unknown>,
): AiMessage[] {
  return [
    {
      role: "system",
      content: `只输出一个 JSON 对象，不要输出 Markdown 或解释。JSON 必须符合这个 Schema：${JSON.stringify(jsonSchema)}`,
    },
    ...messages,
  ];
}

/**
 * 按当前方法从结果里取原始 JSON 文本：
 * - json_schema / json_object 在 message.content；
 * - function 在 message.toolCalls[0].arguments。
 */
function extractStructuredText(
  result: AiGenerationResult,
  method: AiStructuredOutputMethod,
): string {
  if (method === "function") {
    return result.message.toolCalls?.[0]?.arguments ?? "";
  }

  return result.message.content;
}

interface ParseSuccess<T> {
  ok: true;
  value: T;
}

interface ParseFailure {
  ok: false;
}

function parseWithSchema<T>(
  schema: z.ZodType<T>,
  rawText: string,
): ParseSuccess<T> | ParseFailure {
  const trimmed = rawText.trim();

  if (!trimmed) {
    return { ok: false };
  }

  let json: unknown;

  try {
    json = JSON.parse(trimmed);
  } catch {
    return { ok: false };
  }

  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    return { ok: false };
  }

  return { ok: true, value: parsed.data };
}

function toGenerationOptions(options: {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}): AiGenerationOptions {
  return {
    ...(options.temperature !== undefined
      ? { temperature: options.temperature }
      : {}),
    ...(options.maxTokens !== undefined
      ? { maxTokens: options.maxTokens }
      : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };
}
