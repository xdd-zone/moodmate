import { HealthResponseSchema, PingResponseSchema } from "@repo/contracts";
import type { PingRequest } from "@repo/contracts";

import { http } from "@/src/lib/http";
import type { HttpRequestOptions } from "@/src/lib/http";

type SystemRequestOptions = Pick<HttpRequestOptions, "init">;

export function getHealth(options?: SystemRequestOptions) {
  return http.get("/health", HealthResponseSchema, options);
}

export function postPing(payload: PingRequest, options?: SystemRequestOptions) {
  return http.post("/rpc/system/ping", payload, PingResponseSchema, options);
}
