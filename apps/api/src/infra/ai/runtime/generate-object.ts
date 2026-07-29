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
 * 全部方法用尽后抛最后一次错误（无错误时抛 `invalid_output`）。
 */
export async function generateObject<T>(
  options: GenerateObjectOptions<T>,
): Promise<GenerateObjectResult<T>> {
  const provider = getAiProvider(options.model.api);
  const jsonSchema = z.toJSONSchema(options.schema) as Record<string, unknown>;
  const generationOptions = toGenerationOptions(options);

  let lastError: AiError | null = null;

  for (const method of STRUCTURED_OUTPUT_METHODS) {
    const responseFormat: AiResponseFormat = {
      name: options.schemaName,
      jsonSchema,
      method,
    };

    let result: AiGenerationResult;

    try {
      result = await provider.generate({
        model: options.model,
        messages: options.messages,
        options: generationOptions,
        responseFormat,
      });
    } catch (error) {
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
      return { value: parsed.value, usage: result.usage };
    }

    // 输出无法过 Zod：记录后尝试下一种方法。
    lastError = new AiError("invalid_output", "模型返回的结构化结果无法解析", {
      metadata: {
        providerName: options.model.providerName,
        model: options.model.model,
      },
    });
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
