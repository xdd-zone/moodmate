"use client";

import { useChat } from "@ai-sdk/react";
import type {
  CompanionConversationResponse,
  CompanionMessageFeedbackRating,
} from "@repo/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TextStreamChatTransport, type UIMessage } from "ai";
import {
  History,
  LoaderCircle,
  MoreVertical,
  PanelLeft,
  PanelRight,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";

import { getCompanionConversationMessages } from "@/src/api/chat.api";
import {
  companionChatKeys,
  submitCompanionMessageFeedbackMutationOptions,
} from "@/src/api/chat.query";
import { MoodmateAvatar } from "@/src/components/moodmate/avatar";
import type { MoodmateProfile } from "@/src/components/moodmate/models";
import { getWebClientEnv } from "@/src/env/client";
import { fetchWithClientSession } from "@/src/lib/http";

import { ChatComposer } from "./chat-composer";
import { ChatConversation } from "./chat-conversation";

type CompanionChatPaneProps = {
  assistantProfile: MoodmateProfile;
  onInformationToggle: () => void;
  onOpenList: () => void;
  profile: MoodmateProfile;
  serverConversation: CompanionConversationResponse;
};

function getRelationshipStageLabel(messageCount: number) {
  if (messageCount >= 80) return "亲密连结";
  if (messageCount >= 36) return "稳定信任";
  if (messageCount >= 16) return "舒适陪伴";
  if (messageCount >= 6) return "升温熟悉";
  return "初识破冰";
}

export function CompanionChatPane({
  assistantProfile,
  onInformationToggle,
  onOpenList,
  profile,
  serverConversation,
}: CompanionChatPaneProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const transport = useMemo(
    () =>
      new TextStreamChatTransport<UIMessage>({
        api: `${getWebClientEnv().NEXT_PUBLIC_API_BASE_URL}/rpc/chat/companion`,
        fetch: fetchWithClientSession,
        prepareSendMessagesRequest({ api, body, messages }) {
          return {
            api,
            body: {
              ...body,
              conversationId: serverConversation.conversationId,
              messages: messages.slice(-20),
            },
          };
        },
      }),
    [serverConversation.conversationId],
  );
  const {
    clearError,
    error,
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
  } = useChat({
    id: serverConversation.conversationId,
    messages: serverConversation.messages.map(toUiMessage),
    onFinish({ isAbort, isDisconnect, isError }) {
      if (!isAbort && !isDisconnect && !isError) {
        void queryClient.invalidateQueries({
          queryKey: companionChatKeys.conversation(),
        });
      }
    },
    transport,
  });
  const isSending = status === "submitted" || status === "streaming";
  const [nextCursor, setNextCursor] = useState(serverConversation.nextCursor);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState(false);
  const [historicalAssistantMessageIds, setHistoricalAssistantMessageIds] =
    useState<string[]>(() =>
      serverConversation.messages
        .filter((message) => message.role === "assistant")
        .map((message) => message.id),
    );
  const [feedbackByMessageId, setFeedbackByMessageId] = useState<
    Record<string, CompanionMessageFeedbackRating>
  >(() => collectFeedback(serverConversation.messages));
  const feedbackMutation = useMutation(
    submitCompanionMessageFeedbackMutationOptions(queryClient),
  );

  function handleSubmitFeedback(
    messageId: string,
    rating: CompanionMessageFeedbackRating,
  ) {
    if (feedbackMutation.isPending) return;

    feedbackMutation.mutate(
      { messageId, payload: { rating } },
      {
        onSuccess: (result) => {
          setFeedbackByMessageId((current) => ({
            ...current,
            [messageId]: result.feedback.rating,
          }));
        },
      },
    );
  }

  function handleSend() {
    const text = draft.trim();

    if (!text || isSending) return;

    clearError();
    setDraft("");
    void sendMessage({ text });
  }

  async function loadMoreHistory() {
    if (!nextCursor || isLoadingMoreHistory) return;

    setHistoryLoadError(false);
    setIsLoadingMoreHistory(true);

    try {
      const result = await getCompanionConversationMessages(nextCursor);
      const olderMessages = result.messages.map(toUiMessage);
      const olderAssistantIds = result.messages
        .filter((message) => message.role === "assistant")
        .map((message) => message.id);

      setHistoricalAssistantMessageIds((current) => [
        ...new Set([...olderAssistantIds, ...current]),
      ]);
      setFeedbackByMessageId((current) => ({
        ...collectFeedback(result.messages),
        ...current,
      }));
      setMessages((current) => {
        const currentIds = new Set(current.map((message) => message.id));
        return [
          ...olderMessages.filter((message) => !currentIds.has(message.id)),
          ...current,
        ];
      });
      setNextCursor(result.nextCursor);
    } catch {
      setHistoryLoadError(true);
    } finally {
      setIsLoadingMoreHistory(false);
    }
  }

  return (
    <div className="moodmate-chat">
      <header className="moodmate-chat__header">
        <button
          aria-label="打开会话列表"
          className="moodmate-icon-button moodmate-chat__mobile-action"
          onClick={onOpenList}
          title="打开会话列表"
          type="button"
        >
          <PanelLeft aria-hidden="true" />
        </button>
        <MoodmateAvatar
          onSurface
          profile={assistantProfile}
          showStatus
          size="sm"
        />
        <div className="moodmate-chat__heading">
          <h1>
            {assistantProfile.name}
            <span className="moodmate-chat__relationship">
              {getRelationshipStageLabel(serverConversation.messageCount)}
            </span>
          </h1>
          <p>在线</p>
        </div>
        <div className="moodmate-chat__actions">
          <button
            aria-label="消息搜索暂未开放"
            className="moodmate-icon-button"
            disabled
            title="消息搜索暂未开放"
            type="button"
          >
            <Search aria-hidden="true" />
          </button>
          <button
            aria-label="切换资料栏"
            className="moodmate-icon-button"
            onClick={onInformationToggle}
            title="切换资料栏"
            type="button"
          >
            <PanelRight aria-hidden="true" />
          </button>
          <button
            aria-label="更多操作暂未开放"
            className="moodmate-icon-button"
            disabled
            title="更多操作暂未开放"
            type="button"
          >
            <MoreVertical aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="moodmate-chat__body">
        {nextCursor || historyLoadError ? (
          <div className="moodmate-chat__history">
            {historyLoadError ? (
              <>
                <span role="alert">更早的消息加载失败</span>
                <button onClick={() => void loadMoreHistory()} type="button">
                  重试
                </button>
              </>
            ) : (
              <button
                disabled={isLoadingMoreHistory}
                onClick={() => void loadMoreHistory()}
                type="button"
              >
                {isLoadingMoreHistory ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <History aria-hidden="true" />
                )}
                {isLoadingMoreHistory ? "正在加载" : "加载更早消息"}
              </button>
            )}
          </div>
        ) : null}

        <ChatConversation
          assistantProfile={assistantProfile}
          feedbackByMessageId={feedbackByMessageId}
          feedbackPendingMessageId={
            feedbackMutation.isPending
              ? (feedbackMutation.variables?.messageId ?? null)
              : null
          }
          historicalAssistantMessageIds={historicalAssistantMessageIds}
          messages={messages}
          onSubmitFeedback={handleSubmitFeedback}
          status={status}
          userProfile={profile}
        />

        {error ? (
          <div className="moodmate-chat__error" role="alert">
            <p>回复生成失败，请稍后重试。</p>
            <button onClick={clearError} type="button">
              关闭
            </button>
          </div>
        ) : null}

        <ChatComposer
          isSending={isSending}
          onChange={setDraft}
          onStop={() => void stop()}
          onSubmit={handleSend}
          placeholder={`和${assistantProfile.name}说点什么`}
          value={draft}
        />
      </section>
    </div>
  );
}

function toUiMessage(
  message: CompanionConversationResponse["messages"][number],
): UIMessage {
  return {
    id: message.id,
    parts: [{ text: message.content, type: "text" }],
    role: message.role,
  };
}

function collectFeedback(
  messages: CompanionConversationResponse["messages"],
): Record<string, CompanionMessageFeedbackRating> {
  const ratings: Record<string, CompanionMessageFeedbackRating> = {};

  for (const message of messages) {
    if (message.feedback) ratings[message.id] = message.feedback.rating;
  }

  return ratings;
}
