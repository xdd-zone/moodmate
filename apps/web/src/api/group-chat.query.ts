import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  AddAgentGroupChatMembersRequest,
  AgentGroupChatDetail,
  CreateAgentGroupChatRequest,
  SendAgentGroupChatMessageResponse,
} from "@repo/contracts";

import {
  addGroupChatMembers,
  createGroupChat,
  getGroupChatDetail,
  getGroupChats,
  removeGroupChatMember,
  sendGroupChatMessage,
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

interface SendGroupChatMessageVariables {
  groupChatId: string;
  message: string;
}

interface SendGroupChatMessageContext {
  optimisticId: string;
  previous: AgentGroupChatDetail | undefined;
}

export function sendGroupChatMessageMutationOptions(queryClient: QueryClient) {
  return mutationOptions<
    SendAgentGroupChatMessageResponse,
    Error,
    SendGroupChatMessageVariables,
    SendGroupChatMessageContext
  >({
    mutationFn: (variables) =>
      sendGroupChatMessage(variables.groupChatId, {
        message: variables.message,
      }),
    onError: (_error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          groupChatKeys.detail(variables.groupChatId),
          context.previous,
        );
      }
    },
    onMutate: async (variables) => {
      const detailKey = groupChatKeys.detail(variables.groupChatId);
      await queryClient.cancelQueries({ queryKey: detailKey });

      const previous =
        queryClient.getQueryData<AgentGroupChatDetail>(detailKey);
      const optimisticId = `optimistic-${Date.now()}`;
      const nowMs = Date.now();
      const lastTurnIndex = previous?.recentMessages.at(-1)?.turnIndex ?? 0;

      if (previous) {
        queryClient.setQueryData<AgentGroupChatDetail>(detailKey, {
          ...previous,
          recentMessages: [
            ...previous.recentMessages,
            {
              agentId: null,
              agentImageKey: null,
              agentName: null,
              content: variables.message,
              createdAtMs: nowMs,
              groupChatId: variables.groupChatId,
              id: optimisticId,
              senderType: "user",
              status: "completed",
              turnIndex: lastTurnIndex + 1,
            },
          ],
        });
      }

      return { optimisticId, previous };
    },
    onSuccess: (response, variables, context) => {
      const detailKey = groupChatKeys.detail(variables.groupChatId);

      queryClient.setQueryData<AgentGroupChatDetail>(detailKey, (current) => {
        if (!current) {
          return current;
        }

        const serverIds = new Set([
          context.optimisticId,
          response.userMessage.id,
          ...response.agentMessages.map((message) => message.id),
        ]);

        return {
          ...current,
          groupChat: response.groupChat,
          recentMessages: [
            ...current.recentMessages.filter(
              (message) => !serverIds.has(message.id),
            ),
            response.userMessage,
            ...response.agentMessages,
          ],
        };
      });

      void queryClient.invalidateQueries({ queryKey: groupChatKeys.list() });
    },
  });
}
