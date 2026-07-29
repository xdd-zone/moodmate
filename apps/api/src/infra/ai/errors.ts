/**
 * AI 模块统一错误。
 *
 * Provider 依据 SDK error 类型和 HTTP status 转换为 `AiError`；chat、group-chat 和
 * llm-config service 在业务边界再把 `AiError` 转成现有 `BizCode`、HTTP status 和中文文案。
 * AI runtime 与 Provider 不创建 `AppError`，不依赖 Hono 或 contracts。
 *
 * metadata 只允许可安全记录的字段；禁止写入 apiKey、Authorization、完整 prompt、
 * 完整工具参数、完整工具结果或原始上游错误体。
 */

export type AiErrorCode =
  | "invalid_config"
  | "authentication"
  | "permission_denied"
  | "rate_limited"
  | "timeout"
  | "aborted"
  | "network"
  | "invalid_response"
  | "invalid_output"
  | "tool_not_found"
  | "tool_invalid_arguments"
  | "tool_execution_failed"
  | "max_steps"
  | "upstream_error";

/**
 * 可安全记录的错误上下文。字段全部可选，且只保留不含敏感信息的元数据。
 */
export interface AiErrorMetadata {
  /** 上游 HTTP 状态码。 */
  status?: number;
  /** 上游返回的 request id，便于排查。 */
  requestId?: string;
  /** Provider 名称，仅用于识别，不参与实现选择。 */
  providerName?: string;
  /** 模型标识。 */
  model?: string;
  /** 本次请求耗时（毫秒）。 */
  durationMs?: number;
}

export interface AiErrorOptions {
  metadata?: AiErrorMetadata;
  /** 原始错误只用于保留调用栈，不应整体写入日志。 */
  cause?: unknown;
}

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly metadata: AiErrorMetadata;

  constructor(code: AiErrorCode, message: string, options?: AiErrorOptions) {
    super(
      message,
      options?.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = "AiError";
    this.code = code;
    this.metadata = options?.metadata ?? {};
  }
}

export function isAiError(value: unknown): value is AiError {
  return value instanceof AiError;
}
