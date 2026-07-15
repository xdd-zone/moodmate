import { z } from "zod";

export const BizCode = {
  COMMON_INVALID_REQUEST: "COMMON.INVALID_REQUEST",
  COMMON_NOT_FOUND: "COMMON.NOT_FOUND",
  SYSTEM_DATABASE_UNAVAILABLE: "SYSTEM.DATABASE_UNAVAILABLE",
  SYSTEM_INTERNAL_ERROR: "SYSTEM.INTERNAL_ERROR",
  SYSTEM_UPSTREAM_TIMEOUT: "SYSTEM.UPSTREAM_TIMEOUT",
} as const;

export const BizCodeSchema = z.enum(BizCode);

export type BizCodeValue = (typeof BizCode)[keyof typeof BizCode];
