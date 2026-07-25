import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  AddAgentGroupChatMembersRequest,
  CreateAgentGroupChatRequest,
} from "@repo/contracts";

import {
  addGroupChatMembers,
  createGroupChat,
  getGroupChatDetail,
  getGroupChats,
  removeGroupChatMember,
} from "./group-chat.api";

export const groupChatKeys = {
  all: ["group-chats"] as const,
  detail: (groupChatId: string) =>
    [...groupChatKeys.all, "detail", groupChatId] as const,
  list: () => [...groupChatKeys.all, "list"] as const,
  messages: (groupChatId: string) =>
    [...groupChatKeys.all, "messages", groupChatId] as const,
};

export function groupChatsQueryOptions() {
  return queryOptions({
    queryFn: ({ signal }) => getGroupChats({ init: { signal } }),
    queryKey: groupChatKeys.list(),
  });
}

export function groupChatDetailQueryOptions(groupChatId: string) {
  return queryOptions({
    enabled: groupChatId.length > 0,
    queryFn: ({ signal }) =>
      getGroupChatDetail(groupChatId, { init: { signal } }),
    queryKey: groupChatKeys.detail(groupChatId),
  });
}

export function createGroupChatMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (input: CreateAgentGroupChatRequest) => createGroupChat(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: groupChatKeys.list() }),
  });
}

export function addGroupChatMembersMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (input: {
      groupChatId: string;
      payload: AddAgentGroupChatMembersRequest;
    }) => addGroupChatMembers(input.groupChatId, input.payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: groupChatKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: groupChatKeys.detail(variables.groupChatId),
      });
    },
  });
}

export function removeGroupChatMemberMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (input: { groupChatId: string; memberId: string }) =>
      removeGroupChatMember(input.groupChatId, input.memberId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: groupChatKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: groupChatKeys.detail(variables.groupChatId),
      });
    },
  });
}
