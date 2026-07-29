import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  CreateUserAgentRequest,
  UpdateUserAgentRequest,
} from "@repo/contracts";

import {
  createUserAgent,
  deleteUserAgent,
  getUserAgentDetail,
  getUserAgents,
  updateUserAgent,
} from "./agent.api";

export const userAgentKeys = {
  all: ["user-agents"] as const,
  detail: (agentId: string) =>
    [...userAgentKeys.all, "detail", agentId] as const,
  list: () => [...userAgentKeys.all, "list"] as const,
};

export function userAgentsQueryOptions() {
  return queryOptions({
    queryFn: ({ signal }) => getUserAgents({ init: { signal } }),
    queryKey: userAgentKeys.list(),
  });
}

export function userAgentDetailQueryOptions(agentId: string) {
  return queryOptions({
    queryFn: ({ signal }) => getUserAgentDetail(agentId, { init: { signal } }),
    queryKey: userAgentKeys.detail(agentId),
  });
}

export function createUserAgentMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (input: CreateUserAgentRequest) => createUserAgent(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: userAgentKeys.list() }),
  });
}

export function updateUserAgentMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (input: { agentId: string; patch: UpdateUserAgentRequest }) =>
      updateUserAgent(input.agentId, input.patch),
    onSuccess: (response) => {
      queryClient.setQueryData(
        userAgentKeys.detail(response.agent.id),
        response,
      );

      return queryClient.invalidateQueries({ queryKey: userAgentKeys.list() });
    },
  });
}

export function deleteUserAgentMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (agentId: string) => deleteUserAgent(agentId),
    onSuccess: (_response, agentId) => {
      queryClient.removeQueries({ queryKey: userAgentKeys.detail(agentId) });

      return queryClient.invalidateQueries({ queryKey: userAgentKeys.list() });
    },
  });
}
