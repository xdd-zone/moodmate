import { createApiResponseSchema } from "@repo/contracts";
import type { z } from "zod";

import { getAdminServerEnv } from "@/src/env/server";

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

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type HttpRequestBody =
  | { kind: "form"; value: FormData }
  | { kind: "json"; value: unknown };

function resolveBaseURL() {
  if (typeof window === "undefined") {
    return getAdminServerEnv().API_BASE_URL;
  }

  return window.location.origin;
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
  body?: HttpRequestBody,
): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("accept", headers.get("accept") ?? "application/json");

  const requestInit: RequestInit = {
    ...init,
    body: undefined,
    headers,
    method,
  };

  if (method === "GET" || method === "DELETE") {
    return requestInit;
  }

  if (body?.kind === "form") {
    requestInit.body = body.value;
    return requestInit;
  }

  headers.set(
    "content-type",
    headers.get("content-type") ?? "application/json",
  );

  const jsonBody = JSON.stringify(body?.value);
  if (jsonBody === undefined) {
    throw new TypeError("POST payload 必须可以序列化为 JSON");
  }

  requestInit.body = jsonBody;

  return requestInit;
}

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

async function request<TData>(
  method: HttpMethod,
  path: string,
  responseSchema: z.ZodType<TData>,
  options?: HttpRequestOptions,
  body?: HttpRequestBody,
): Promise<TData> {
  const url = buildURL(path, options?.query);
  const requestInit = createRequestInit(method, options?.init, body);
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

  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch (error) {
    throw new HttpRequestError("API 返回的内容不是有效 JSON", {
      cause: error,
      kind: "invalid-response",
      status: response.status,
    });
  }

  const result =
    createApiResponseSchema(responseSchema).safeParse(responseBody);
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
    return request("POST", path, responseSchema, options, {
      kind: "json",
      value: payload,
    });
  },
  patch<TPayload, TData>(
    path: string,
    payload: TPayload,
    responseSchema: z.ZodType<TData>,
    options?: HttpRequestOptions,
  ) {
    return request("PATCH", path, responseSchema, options, {
      kind: "json",
      value: payload,
    });
  },
  delete<TData>(
    path: string,
    responseSchema: z.ZodType<TData>,
    options?: HttpRequestOptions,
  ) {
    return request("DELETE", path, responseSchema, options);
  },
  postForm<TData>(
    path: string,
    formData: FormData,
    responseSchema: z.ZodType<TData>,
    options?: HttpRequestOptions,
  ) {
    return request("POST", path, responseSchema, options, {
      kind: "form",
      value: formData,
    });
  },
};

export { HttpRequestError } from "./error";
export type { HttpErrorKind, HttpRequestErrorOptions } from "./error";
