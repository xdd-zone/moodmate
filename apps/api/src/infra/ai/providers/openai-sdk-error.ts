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

import { AiError } from "../errors";
import type { AiErrorCode, AiErrorMetadata } from "../errors";

interface OpenAiErrorContext {
  signal?: AbortSignal;
  providerName: string;
  model: string;
  durationMs: number;
}

const RUNTIME_ABORT_MAX_DEPTH = 5;

/**
 * workerd 在请求上下文销毁时会直接掐断进行中的 subrequest。这类错误不带 HTTP 状态，
 * 也不保证触发调用方的 AbortSignal，只能从消息文本识别。
 * 客户端提前断开就走这条路径，它不是模型服务故障，记成 aborted 才不会污染失败率。
 */
const RUNTIME_ABORT_PATTERNS = [
  "Network connection lost",
  "internal error; reference =",
];

function isRuntimeAbort(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < RUNTIME_ABORT_MAX_DEPTH; depth += 1) {
    if (!(current instanceof Error)) return false;

    const message = current.message;

    if (RUNTIME_ABORT_PATTERNS.some((pattern) => message.includes(pattern))) {
      return true;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

/** OpenAI SDK error 转为 AI runtime 的稳定错误。 */
export function mapOpenAiSdkError(
  error: unknown,
  context: OpenAiErrorContext,
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

  if (isRuntimeAbort(error)) {
    return new AiError("aborted", "请求被运行时中断", {
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
    const { code, message } = classifyOpenAiApiError(error);

    return new AiError(code, message, { metadata, cause: error });
  }

  return new AiError("upstream_error", "模型服务返回未知错误", {
    metadata: baseMetadata,
    cause: error,
  });
}

function classifyOpenAiApiError(error: APIError): {
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
