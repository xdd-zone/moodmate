import {
  AdminAiCallListQuerySchema,
  AdminAiCallListResponseSchema,
  AdminAgentDetailResponseSchema,
  AdminAgentListQuerySchema,
  AdminAgentListResponseSchema,
  AdminMessageFeedbackDetailResponseSchema,
  AdminMessageFeedbackListQuerySchema,
  AdminMessageFeedbackListResponseSchema,
  AdminMessageFeedbackUpdateRequestSchema,
  AdminMessageFeedbackUpdateResponseSchema,
  AdminOverviewResponseSchema,
  AdminSystemAgentDeleteResponseSchema,
  AdminSystemAgentMutationRequestSchema,
  AdminSystemAgentMutationResponseSchema,
  AdminSystemAgentUpdateRequestSchema,
  AdminUserAiUsageResponseSchema,
  AdminUserDetailResponseSchema,
  type AdminAiCallListQuery,
  type AdminAgentListQuery,
  type AdminMessageFeedbackListQuery,
  type AdminMessageFeedbackUpdateRequest,
  type AdminSystemAgentMutationRequest,
  type AdminSystemAgentUpdateRequest,
} from "@repo/contracts";
import { http } from "@/src/lib/http";
import { withAdminSessionRecovery } from "@/src/auth/api";

export const getAdminOverview = () =>
  withAdminSessionRecovery(() =>
    http.get("/api/operations/overview", AdminOverviewResponseSchema),
  );
export const getAdminAgents = (query: AdminAgentListQuery) =>
  withAdminSessionRecovery(() =>
    http.get("/api/operations/agents", AdminAgentListResponseSchema, {
      query: AdminAgentListQuerySchema.parse(query),
    }),
  );
export const getAdminAgentDetail = (id: string) =>
  withAdminSessionRecovery(() =>
    http.get(
      `/api/operations/agents/${encodeURIComponent(id)}`,
      AdminAgentDetailResponseSchema,
    ),
  );
export const getAdminFeedbacks = (query: AdminMessageFeedbackListQuery) =>
  withAdminSessionRecovery(() =>
    http.get(
      "/api/operations/message-feedbacks",
      AdminMessageFeedbackListResponseSchema,
      { query: AdminMessageFeedbackListQuerySchema.parse(query) },
    ),
  );
export const getAdminFeedbackDetail = (id: string) =>
  withAdminSessionRecovery(() =>
    http.get(
      `/api/operations/message-feedbacks/${encodeURIComponent(id)}`,
      AdminMessageFeedbackDetailResponseSchema,
    ),
  );
export const updateAdminFeedbackStatus = (
  id: string,
  payload: AdminMessageFeedbackUpdateRequest,
) =>
  withAdminSessionRecovery(() =>
    http.patch(
      `/api/operations/message-feedbacks/${encodeURIComponent(id)}`,
      AdminMessageFeedbackUpdateRequestSchema.parse(payload),
      AdminMessageFeedbackUpdateResponseSchema,
    ),
  );
export const getAdminUserDetail = (userId: string) =>
  withAdminSessionRecovery(() =>
    http.get(
      `/api/operations/users/${encodeURIComponent(userId)}`,
      AdminUserDetailResponseSchema,
    ),
  );
export const getAdminUserUsage = (userId: string) =>
  withAdminSessionRecovery(() =>
    http.get(
      `/api/operations/users/${encodeURIComponent(userId)}/ai-usage`,
      AdminUserAiUsageResponseSchema,
    ),
  );
export const getAdminUserCalls = (
  userId: string,
  query: AdminAiCallListQuery,
) =>
  withAdminSessionRecovery(() =>
    http.get(
      `/api/operations/users/${encodeURIComponent(userId)}/ai-calls`,
      AdminAiCallListResponseSchema,
      { query: AdminAiCallListQuerySchema.parse(query) },
    ),
  );
export const createAdminSystemAgent = (
  payload: AdminSystemAgentMutationRequest,
) =>
  withAdminSessionRecovery(() =>
    http.post(
      "/api/operations/agents/system",
      AdminSystemAgentMutationRequestSchema.parse(payload),
      AdminSystemAgentMutationResponseSchema,
    ),
  );
export const updateAdminSystemAgent = (
  id: string,
  payload: AdminSystemAgentUpdateRequest,
) =>
  withAdminSessionRecovery(() =>
    http.patch(
      `/api/operations/agents/system/${encodeURIComponent(id)}`,
      AdminSystemAgentUpdateRequestSchema.parse(payload),
      AdminSystemAgentMutationResponseSchema,
    ),
  );
export const disableAdminSystemAgent = (id: string) =>
  withAdminSessionRecovery(() =>
    http.post(
      `/api/operations/agents/system/${encodeURIComponent(id)}/disable`,
      {},
      AdminSystemAgentMutationResponseSchema,
    ),
  );
export const enableAdminSystemAgent = (id: string) =>
  withAdminSessionRecovery(() =>
    http.post(
      `/api/operations/agents/system/${encodeURIComponent(id)}/enable`,
      {},
      AdminSystemAgentMutationResponseSchema,
    ),
  );
export const deleteAdminSystemAgent = (id: string) =>
  withAdminSessionRecovery(() =>
    http.delete(
      `/api/operations/agents/system/${encodeURIComponent(id)}`,
      AdminSystemAgentDeleteResponseSchema,
    ),
  );
