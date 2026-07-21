import {
  BizCode,
  WebTokenRefreshResponseSchema,
  createApiResponseSchema,
} from "@repo/contracts";
import type { z } from "zod";

import {
  clearClientSession,
  readClientSession,
  saveClientSession,
} from "@/src/auth/client-session";
import { getWebClientEnv } from "@/src/env/client";
import { getWebServerEnv } from "@/src/env/server";

import { HttpRequestError } from "./error";

export type HttpQueryValue = string | number | boolean | null | undefined;

export type HttpQuery = Record<
  string,
  HttpQueryValue | readonly HttpQueryValue[]
>;

export type HttpRequestOptions = {
  init?: RequestInit;
  query?: HttpQuery;
};

type HttpMethod = "GET" | "POST";

interface PreparedRequest {
  init: RequestInit;
  usesClientSession: boolean;
}

let refreshPromise: Promise<void> | null = null;

function resolveBaseURL() {
  if (typeof window === "undefined") {
    return getWebServerEnv().API_BASE_URL;
  }

  return getWebClientEnv().NEXT_PUBLIC_API_BASE_URL;
}

function isQueryValueList(
  value: HttpQueryValue | readonly HttpQueryValue[],
): value is readonly HttpQueryValue[] {
  return Array.isArray(value);
}

function appendQueryValue(
  params: URLSearchParams,
  key: string,
  value: HttpQueryValue,
) {
  if (value === undefined || value === null) {
    return;
  }

  params.append(key, String(value));
}

function buildURL(path: string, query?: HttpQuery) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new TypeError("HTTP path 必须是以 / 开头的应用内路径");
  }

  const url = new URL(path, resolveBaseURL());

  for (const [key, value] of Object.entries(query ?? {})) {
    if (isQueryValueList(value)) {
      for (const item of value) {
        appendQueryValue(url.searchParams, key, item);
      }

      continue;
    }

    appendQueryValue(url.searchParams, key, value);
  }

  return url.toString();
}

function createRequestInit(
  method: HttpMethod,
  init?: RequestInit,
  payload?: unknown,
  attachClientSession = true,
): PreparedRequest {
  const headers = new Headers(init?.headers);
  headers.set("accept", headers.get("accept") ?? "application/json");

  let usesClientSession = false;

  if (
    attachClientSession &&
    typeof window !== "undefined" &&
    !headers.has("authorization")
  ) {
    const storedSession = readClientSession();

    if (storedSession) {
      headers.set("authorization", `Bearer ${storedSession.accessToken}`);
      usesClientSession = true;
    }
  }

  const requestInit: RequestInit = {
    ...init,
    body: undefined,
    headers,
    method,
  };

  if (method === "GET") {
    return { init: requestInit, usesClientSession };
  }

  headers.set(
    "content-type",
    headers.get("content-type") ?? "application/json",
  );

  const body = JSON.stringify(payload);
  if (body === undefined) {
    throw new TypeError("POST payload 必须可以序列化为 JSON");
  }

  requestInit.body = body;

  return { init: requestInit, usesClientSession };
}

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

async function executeRequest<TData>(
  url: string,
  requestInit: RequestInit,
  responseSchema: z.ZodType<TData>,
): Promise<TData> {
  let response: Response;

  try {
    response = await fetch(url, requestInit);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new HttpRequestError("API 请求失败，请检查网络或服务地址", {
      cause: error,
      kind: "network",
    });
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch (error) {
    throw new HttpRequestError("API 返回的内容不是有效 JSON", {
      cause: error,
      kind: "invalid-response",
      status: response.status,
    });
  }

  const result = createApiResponseSchema(responseSchema).safeParse(body);
  if (!result.success) {
    throw new HttpRequestError("API 返回的数据结构无效", {
      cause: result.error,
      kind: "invalid-response",
      status: response.status,
    });
  }

  if (!result.data.ok) {
    throw new HttpRequestError(result.data.error.message, {
      code: result.data.error.code,
      details: result.data.error.details,
      kind: "api",
      requestId: result.data.meta.requestId,
      status: response.status,
    });
  }

  if (!response.ok) {
    throw new HttpRequestError("API 返回了与 HTTP 状态不一致的成功响应", {
      kind: "http",
      requestId: result.data.meta.requestId,
      status: response.status,
    });
  }

  return result.data.data;
}

async function refreshClientSession() {
  const storedSession = readClientSession();

  if (!storedSession) {
    throw new HttpRequestError("登录状态已失效，请重新登录", {
      kind: "http",
      status: 401,
    });
  }

  const url = buildURL("/auth/web/token/refresh");
  const request = createRequestInit(
    "POST",
    undefined,
    { refreshToken: storedSession.refreshToken },
    false,
  );
  const response = await executeRequest(
    url,
    request.init,
    WebTokenRefreshResponseSchema,
  );

  saveClientSession(response);
}

function ensureClientRefresh() {
  if (!refreshPromise) {
    refreshPromise = refreshClientSession().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function shouldRefresh(error: unknown, usesClientSession: boolean) {
  return (
    usesClientSession &&
    error instanceof HttpRequestError &&
    error.code === BizCode.AUTH_ACCESS_EXPIRED
  );
}

async function request<TData>(
  method: HttpMethod,
  path: string,
  responseSchema: z.ZodType<TData>,
  options?: HttpRequestOptions,
  payload?: unknown,
): Promise<TData> {
  const url = buildURL(path, options?.query);
  const initialRequest = createRequestInit(method, options?.init, payload);

  try {
    return await executeRequest(url, initialRequest.init, responseSchema);
  } catch (error) {
    if (!shouldRefresh(error, initialRequest.usesClientSession)) {
      throw error;
    }
  }

  try {
    await ensureClientRefresh();
    const retryRequest = createRequestInit(method, options?.init, payload);
    return await executeRequest(url, retryRequest.init, responseSchema);
  } catch (error) {
    if (!isAbortError(error)) {
      clearClientSession();
    }

    throw error;
  }
}

export const http = {
  get<TData>(
    path: string,
    responseSchema: z.ZodType<TData>,
    options?: HttpRequestOptions,
  ) {
    return request("GET", path, responseSchema, options);
  },
  post<TPayload, TData>(
    path: string,
    payload: TPayload,
    responseSchema: z.ZodType<TData>,
    options?: HttpRequestOptions,
  ) {
    return request("POST", path, responseSchema, options, payload);
  },
};

export { HttpRequestError } from "./error";
export type { HttpErrorKind, HttpRequestErrorOptions } from "./error";
