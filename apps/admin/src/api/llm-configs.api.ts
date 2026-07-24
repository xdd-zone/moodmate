import {
  LlmConfigCreateRequestSchema,
  LlmConfigDeleteResponseSchema,
  LlmConfigListResponseSchema,
  LlmConfigMutationResponseSchema,
  LlmConfigTestRequestSchema,
  LlmConfigTestResponseSchema,
  LlmConfigUpdateRequestSchema,
  type LlmConfigCreateRequest,
  type LlmConfigTestRequest,
  type LlmConfigUpdateRequest,
} from "@repo/contracts";

import { withAdminSessionRecovery } from "@/src/auth/api";
import { http } from "@/src/lib/http";

export function getAdminLlmConfigs() {
  return withAdminSessionRecovery(() =>
    http.get("/api/llm-configs", LlmConfigListResponseSchema),
  );
}

export function createAdminLlmConfig(payload: LlmConfigCreateRequest) {
  return withAdminSessionRecovery(() =>
    http.post(
      "/api/llm-configs",
      LlmConfigCreateRequestSchema.parse(payload),
      LlmConfigMutationResponseSchema,
    ),
  );
}

export function updateAdminLlmConfig(
  id: string,
  payload: LlmConfigUpdateRequest,
) {
  return withAdminSessionRecovery(() =>
    http.post(
      `/api/llm-configs/${id}`,
      LlmConfigUpdateRequestSchema.parse(payload),
      LlmConfigMutationResponseSchema,
    ),
  );
}

export function activateAdminLlmConfig(id: string) {
  return withAdminSessionRecovery(() =>
    http.post(
      `/api/llm-configs/${id}/activate`,
      {},
      LlmConfigMutationResponseSchema,
    ),
  );
}

export function deleteAdminLlmConfig(id: string) {
  return withAdminSessionRecovery(() =>
    http.post(
      `/api/llm-configs/${id}/delete`,
      {},
      LlmConfigDeleteResponseSchema,
    ),
  );
}

export function testAdminLlmConfig(payload: LlmConfigTestRequest) {
  return withAdminSessionRecovery(() =>
    http.post(
      "/api/llm-configs/test",
      LlmConfigTestRequestSchema.parse(payload),
      LlmConfigTestResponseSchema,
    ),
  );
}
