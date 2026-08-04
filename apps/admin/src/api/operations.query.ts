import { queryOptions } from "@tanstack/react-query";
import type {
  AdminAiCallListQuery,
  AdminAgentListQuery,
  AdminMessageFeedbackListQuery,
} from "@repo/contracts";
import {
  createAdminSystemAgent,
  deleteAdminSystemAgent,
  disableAdminSystemAgent,
  enableAdminSystemAgent,
  getAdminAgents,
  getAdminFeedbackDetail,
  getAdminFeedbacks,
  getAdminOverview,
  getAdminUserCalls,
  getAdminUserDetail,
  getAdminUserUsage,
  updateAdminFeedbackStatus,
  updateAdminSystemAgent,
} from "./operations.api";
import type {
  AdminSystemAgentMutationRequest,
  AdminSystemAgentUpdateRequest,
  AdminMessageFeedbackUpdateRequest,
} from "@repo/contracts";
import type { QueryClient } from "@tanstack/react-query";
export const operationsKeys = {
  all: ["admin-operations"] as const,
  overview: () => ["admin-operations", "overview"] as const,
  agents: (q: AdminAgentListQuery) =>
    ["admin-operations", "agents", q] as const,
  feedbacks: (q: AdminMessageFeedbackListQuery) =>
    ["admin-operations", "feedbacks", q] as const,
  feedback: (id: string) => ["admin-operations", "feedback", id] as const,
  user: (id: string) => ["admin-operations", "user", id] as const,
  usage: (id: string) => ["admin-operations", "usage", id] as const,
  calls: (id: string, q: AdminAiCallListQuery) =>
    ["admin-operations", "calls", id, q] as const,
};
export const adminOverviewQueryOptions = () =>
  queryOptions({
    queryKey: operationsKeys.overview(),
    queryFn: getAdminOverview,
  });
export const adminAgentsQueryOptions = (q: AdminAgentListQuery) =>
  queryOptions({
    queryKey: operationsKeys.agents(q),
    queryFn: () => getAdminAgents(q),
  });
export const adminFeedbacksQueryOptions = (q: AdminMessageFeedbackListQuery) =>
  queryOptions({
    queryKey: operationsKeys.feedbacks(q),
    queryFn: () => getAdminFeedbacks(q),
  });
export const adminFeedbackDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: operationsKeys.feedback(id),
    queryFn: () => getAdminFeedbackDetail(id),
    enabled: Boolean(id),
  });
export const adminUserDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: operationsKeys.user(id),
    queryFn: () => getAdminUserDetail(id),
    enabled: Boolean(id),
  });
export const adminUserUsageQueryOptions = (id: string) =>
  queryOptions({
    queryKey: operationsKeys.usage(id),
    queryFn: () => getAdminUserUsage(id),
    enabled: Boolean(id),
  });
export const adminUserCallsQueryOptions = (
  id: string,
  q: AdminAiCallListQuery,
) =>
  queryOptions({
    queryKey: operationsKeys.calls(id, q),
    queryFn: () => getAdminUserCalls(id, q),
    enabled: Boolean(id),
  });
export const adminSystemAgentMutationOptions = (queryClient: QueryClient) => ({
  mutationFn: (payload: AdminSystemAgentMutationRequest) =>
    createAdminSystemAgent(payload),
  onSuccess: () =>
    queryClient.invalidateQueries({
      queryKey: operationsKeys.agents({ page: 1, pageSize: 50 }),
    }),
});
export const adminSystemAgentUpdateMutationOptions = (
  queryClient: QueryClient,
) => ({
  mutationFn: ({
    id,
    payload,
  }: {
    id: string;
    payload: AdminSystemAgentUpdateRequest;
  }) => updateAdminSystemAgent(id, payload),
  onSuccess: () =>
    queryClient.invalidateQueries({ queryKey: operationsKeys.all }),
});
export const adminSystemAgentDisableMutationOptions = (
  queryClient: QueryClient,
) => ({
  mutationFn: disableAdminSystemAgent,
  onSuccess: () =>
    queryClient.invalidateQueries({ queryKey: operationsKeys.all }),
});
export const adminSystemAgentEnableMutationOptions = (
  queryClient: QueryClient,
) => ({
  mutationFn: enableAdminSystemAgent,
  onSuccess: () =>
    queryClient.invalidateQueries({ queryKey: operationsKeys.all }),
});
export const adminSystemAgentDeleteMutationOptions = (
  queryClient: QueryClient,
) => ({
  mutationFn: deleteAdminSystemAgent,
  onSuccess: () =>
    queryClient.invalidateQueries({ queryKey: operationsKeys.all }),
});
export const adminFeedbackStatusMutationOptions = (
  queryClient: QueryClient,
) => ({
  mutationFn: ({
    id,
    payload,
  }: {
    id: string;
    payload: AdminMessageFeedbackUpdateRequest;
  }) => updateAdminFeedbackStatus(id, payload),
  onSuccess: () =>
    queryClient.invalidateQueries({ queryKey: operationsKeys.all }),
});
