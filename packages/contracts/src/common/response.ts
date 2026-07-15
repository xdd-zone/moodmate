import { z } from "zod";

import { BizCodeSchema } from "./biz-code";
import type { BizCodeValue } from "./biz-code";

export const ApiMetaSchema = z.object({
  requestId: z.string().min(1),
  timestamp: z.iso.datetime(),
});

export type ApiMeta = z.infer<typeof ApiMetaSchema>;

export const ApiErrorSchema = z.object({
  code: BizCodeSchema,
  details: z.unknown().optional(),
  message: z.string().min(1),
});

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

export function createApiResponseSchema<TData>(
  dataSchema: z.ZodType<TData>,
): z.ZodType<ApiResponse<TData>> {
  return z.discriminatedUnion("ok", [
    z.object({
      data: dataSchema,
      meta: ApiMetaSchema,
      ok: z.literal(true),
    }),
    z.object({
      error: ApiErrorSchema,
      meta: ApiMetaSchema,
      ok: z.literal(false),
    }),
  ]);
}

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
