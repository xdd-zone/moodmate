import {
  BizCode,
  buildFailure,
  buildSuccess,
  type ApiResponse,
  type BizCodeValue,
} from "@repo/contracts";
import { NextResponse } from "next/server";
import type { z } from "zod";

function createMeta() {
  return {
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
}

export function jsonResponse<TData>(body: ApiResponse<TData>, status = 200) {
  return NextResponse.json(body, { status });
}

export function successResponse<TData>(data: TData, status = 200) {
  return jsonResponse(buildSuccess(data, createMeta()), status);
}

export function failureResponse(
  code: BizCodeValue,
  message: string,
  status: number,
  details?: unknown,
) {
  return jsonResponse(
    buildFailure(
      {
        code,
        details,
        message,
      },
      createMeta(),
    ),
    status,
  );
}

export function invalidOriginResponse() {
  return failureResponse(
    BizCode.COMMON_INVALID_REQUEST,
    "请求来源无效，请刷新管理台后重试",
    403,
  );
}

export function upstreamFailureResponse(
  error: unknown,
  fallbackMessage = "认证服务暂时不可用，请稍后重试",
) {
  const message =
    error instanceof Error && error.message ? error.message : fallbackMessage;

  return failureResponse(BizCode.SYSTEM_INTERNAL_ERROR, message, 502);
}

export async function parseJsonRequest<TData>(
  request: Request,
  schema: z.ZodType<TData>,
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      ok: false as const,
      response: failureResponse(
        BizCode.COMMON_INVALID_REQUEST,
        "请求内容必须是有效 JSON",
        400,
      ),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false as const,
      response: failureResponse(
        BizCode.COMMON_INVALID_REQUEST,
        "请求参数无效",
        400,
        result.error.issues,
      ),
    };
  }

  return {
    data: result.data,
    ok: true as const,
  };
}
