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
