import type { BizCodeValue } from "./biz-code";

export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiSuccess<TData> {
  data: TData;
  meta: ApiMeta;
  ok: true;
}

export interface ApiError<TDetails = unknown> {
  code: BizCodeValue;
  details?: TDetails;
  message: string;
}

export interface ApiFailure<TDetails = unknown> {
  error: ApiError<TDetails>;
  meta: ApiMeta;
  ok: false;
}

export type ApiResponse<TData, TDetails = unknown> =
  | ApiSuccess<TData>
  | ApiFailure<TDetails>;

export function buildSuccess<TData>(
  data: TData,
  meta: ApiMeta,
): ApiSuccess<TData> {
  return {
    data,
    meta,
    ok: true,
  };
}

export function buildFailure<TDetails>(
  error: ApiError<TDetails>,
  meta: ApiMeta,
): ApiFailure<TDetails> {
  return {
    error,
    meta,
    ok: false,
  };
}
