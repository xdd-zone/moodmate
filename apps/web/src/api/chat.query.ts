import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  GenerateCompanionCareEventRequest,
  UpsertCompanionCarePlanRequest,
} from "@repo/contracts";

import {
  generateCompanionCareEvent,
  getAgentMemories,
  getCompanionCareEvents,
  getCompanionCarePlan,
  updateCompanionCarePlan,
} from "./chat.api";

export const companionChatKeys = {
  all: ["companion-chat"] as const,
  careEvents: () => [...companionChatKeys.all, "care-events"] as const,
  carePlan: () => [...companionChatKeys.all, "care-plan"] as const,
  memories: (agentId: string) =>
    [...companionChatKeys.all, "memories", agentId] as const,
};

export function agentMemoriesQueryOptions(agentId: string) {
  return queryOptions({
    enabled: Boolean(agentId),
    queryFn: ({ signal }) => getAgentMemories(agentId, { init: { signal } }),
    queryKey: companionChatKeys.memories(agentId),
  });
}

export function companionCarePlanQueryOptions() {
  return queryOptions({
    queryFn: ({ signal }) => getCompanionCarePlan({ init: { signal } }),
    queryKey: companionChatKeys.carePlan(),
  });
}

export function careEventsQueryOptions() {
  return queryOptions({
    queryFn: ({ signal }) => getCompanionCareEvents({ init: { signal } }),
    queryKey: companionChatKeys.careEvents(),
  });
}

export function updateCompanionCarePlanMutationOptions(
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (input: UpsertCompanionCarePlanRequest) =>
      updateCompanionCarePlan(input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: companionChatKeys.carePlan(),
      }),
  });
}

export function generateCompanionCareEventMutationOptions(
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (input: GenerateCompanionCareEventRequest) =>
      generateCompanionCareEvent(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: companionChatKeys.careEvents(),
      });
    },
  });
}
