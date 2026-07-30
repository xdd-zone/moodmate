"use client";

import type { CompanionMessageFeedbackRating } from "@repo/contracts";
import type { ChatStatus, UIMessage } from "ai";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { MoodmateAvatar } from "@/src/components/moodmate/avatar";
import { classNames } from "@/src/components/moodmate/class-names";
import type { MoodmateProfile } from "@/src/components/moodmate/models";

import {
  ChatDateDivider,
  ChatTypingDots,
  CopyMessageButton,
  formatMessageTime,
  isSameLocalDate,
} from "./chat-message-details";
import { FriendAvatarMenu } from "./friend-avatar-menu";

const TYPEWRITER_INTERVAL_MS = 18;

export type CompanionUiMessage = UIMessage<{ createdAtMs?: number }>;

interface ChatConversationProps {
  assistantProfile: MoodmateProfile;
  feedbackByMessageId: Record<string, CompanionMessageFeedbackRating>;
  feedbackPendingMessageId: string | null;
  historicalAssistantMessageIds: readonly string[];
  messages: CompanionUiMessage[];
  onSubmitFeedback: (
    messageId: string,
    rating: CompanionMessageFeedbackRating,
  ) => void;
  status: ChatStatus;
  userProfile: MoodmateProfile;
}

function getMessageText(message: CompanionUiMessage): string {
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("");
}

function sliceUnicodeText(value: string, length: number): string {
  return Array.from(value).slice(0, length).join("");
}

function usePrefersReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  return reducedMotion;
}

export function ChatConversation({
  assistantProfile,
  feedbackByMessageId,
  feedbackPendingMessageId,
  historicalAssistantMessageIds,
  messages,
  onSubmitFeedback,
  status,
  userProfile,
}: ChatConversationProps) {
  const reducedMotion = usePrefersReducedMotion();
  const endRef = useRef<HTMLDivElement>(null);
  const localCreatedAtByIdRef = useRef(new Map<string, number>());
  const historicalAssistantMessageIdSet = useMemo(
    () => new Set(historicalAssistantMessageIds),
    [historicalAssistantMessageIds],
  );
  const [visibleAssistantTextById, setVisibleAssistantTextById] = useState<
    Record<string, string>
  >(() => {
    const initialText: Record<string, string> = {};

    for (const message of messages) {
      if (
        message.role === "assistant" &&
        historicalAssistantMessageIdSet.has(message.id)
      ) {
        initialText[message.id] = getMessageText(message);
      }
    }

    return initialText;
  });
  const assistantFullTextById = useMemo(() => {
    const textById: Record<string, string> = {};

    for (const message of messages) {
      if (message.role === "assistant") {
        const text = getMessageText(message);

        if (text) {
          textById[message.id] = text;
        }
      }
    }

    return textById;
  }, [messages]);

  useEffect(() => {
    setVisibleAssistantTextById((current) => {
      const next: Record<string, string> = {};
      let changed = false;

      for (const [id, fullText] of Object.entries(assistantFullTextById)) {
        const visibleText = current[id];

        if (reducedMotion || historicalAssistantMessageIdSet.has(id)) {
          next[id] = fullText;
          changed ||= visibleText !== fullText;
        } else if (
          visibleText === undefined ||
          !fullText.startsWith(visibleText)
        ) {
          next[id] = sliceUnicodeText(fullText, 1);
          changed = true;
        } else {
          next[id] = visibleText;
        }
      }

      changed ||= Object.keys(current).length !== Object.keys(next).length;
      return changed ? next : current;
    });
  }, [assistantFullTextById, historicalAssistantMessageIdSet, reducedMotion]);

  const hasTypewriterWork = Object.entries(assistantFullTextById).some(
    ([id, fullText]) => {
      const visibleText = visibleAssistantTextById[id] ?? "";
      return Array.from(visibleText).length < Array.from(fullText).length;
    },
  );

  useEffect(() => {
    if (reducedMotion || !hasTypewriterWork) {
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleAssistantTextById((current) => {
        const next = { ...current };
        let changed = false;

        for (const [id, fullText] of Object.entries(assistantFullTextById)) {
          const visibleText = current[id] ?? "";
          const visibleLength = Array.from(visibleText).length;
          const fullLength = Array.from(fullText).length;

          if (visibleLength < fullLength) {
            next[id] = sliceUnicodeText(fullText, visibleLength + 1);
            changed = true;
          }
        }

        return changed ? next : current;
      });
    }, TYPEWRITER_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [
    assistantFullTextById,
    hasTypewriterWork,
    reducedMotion,
    visibleAssistantTextById,
  ]);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, reducedMotion, status, visibleAssistantTextById]);

  const latestMessage = messages.at(-1);
  const latestAssistantText =
    latestMessage?.role === "assistant" ? getMessageText(latestMessage) : "";
  const showLoading =
    status === "submitted" ||
    (status === "streaming" &&
      (latestMessage?.role !== "assistant" || !latestAssistantText));

  function getCreatedAtMs(message: CompanionUiMessage): number {
    if (message.metadata?.createdAtMs !== undefined) {
      return message.metadata.createdAtMs;
    }

    const knownCreatedAtMs = localCreatedAtByIdRef.current.get(message.id);
    if (knownCreatedAtMs !== undefined) return knownCreatedAtMs;

    const createdAtMs = Date.now();
    localCreatedAtByIdRef.current.set(message.id, createdAtMs);
    return createdAtMs;
  }

  return (
    <div
      aria-label={`与${assistantProfile.name}的对话`}
      className="moodmate-messages moodmate-scroll"
      role="log"
    >
      <div className="moodmate-messages__inner">
        {messages.length === 0 ? (
          <div className="moodmate-message moodmate-message--incoming">
            <MoodmateAvatar onSurface profile={assistantProfile} size="sm" />
            <div className="moodmate-message__bubble">
              我在。今天想聊点什么？
            </div>
          </div>
        ) : null}

        {messages.map((message, index) => {
          const fullText = getMessageText(message);

          if (message.role === "assistant" && !fullText.trim()) {
            return null;
          }

          const isUser = message.role === "user";
          const visibleText = isUser
            ? fullText
            : (visibleAssistantTextById[message.id] ??
              sliceUnicodeText(fullText, 1));
          const canFeedback =
            !isUser && historicalAssistantMessageIdSet.has(message.id);
          const createdAtMs = getCreatedAtMs(message);
          const previousMessage = messages[index - 1];
          const previousCreatedAtMs = previousMessage
            ? getCreatedAtMs(previousMessage)
            : null;
          const startsNewDay =
            previousCreatedAtMs === null ||
            !isSameLocalDate(previousCreatedAtMs, createdAtMs);
          const isStacked =
            !startsNewDay && previousMessage?.role === message.role;

          return (
            <div className="moodmate-message-row" key={message.id}>
              {startsNewDay ? (
                <ChatDateDivider createdAtMs={createdAtMs} />
              ) : null}
              <div
                className={classNames(
                  "moodmate-message",
                  isUser
                    ? "moodmate-message--outgoing"
                    : "moodmate-message--incoming",
                  isStacked && "moodmate-message--stacked",
                )}
              >
                {isStacked ? (
                  <span
                    aria-hidden="true"
                    className="moodmate-message__avatar-placeholder"
                  />
                ) : isUser ? (
                  <MoodmateAvatar profile={userProfile} size="sm" />
                ) : (
                  <FriendAvatarMenu
                    onSurface
                    profile={assistantProfile}
                    profileHref="/friends"
                    size="sm"
                  />
                )}
                <div className="moodmate-message__content">
                  <div className="moodmate-message__bubble">
                    {isUser ? (
                      fullText
                    ) : (
                      <>
                        <span aria-hidden="true">{visibleText}</span>
                        <span className="sr-only">{fullText}</span>
                      </>
                    )}
                    <time dateTime={new Date(createdAtMs).toISOString()}>
                      {formatMessageTime(createdAtMs)}
                    </time>
                  </div>
                  <div className="moodmate-message__feedback">
                    {canFeedback ? (
                      <FeedbackControls
                        disabled={feedbackPendingMessageId === message.id}
                        onSubmitFeedback={(rating) =>
                          onSubmitFeedback(message.id, rating)
                        }
                        rating={feedbackByMessageId[message.id] ?? null}
                      />
                    ) : null}
                    <CopyMessageButton text={fullText} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {showLoading ? (
          <div
            className="moodmate-message moodmate-message--incoming"
            role="status"
          >
            {latestMessage?.role === "assistant" ? (
              <span
                aria-hidden="true"
                className="moodmate-message__avatar-placeholder"
              />
            ) : (
              <FriendAvatarMenu
                onSurface
                profile={assistantProfile}
                profileHref="/friends"
                size="sm"
              />
            )}
            <div className="moodmate-message__typing">
              <ChatTypingDots label={`${assistantProfile.name}正在回复`} />
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function FeedbackControls({
  disabled,
  onSubmitFeedback,
  rating,
}: {
  disabled: boolean;
  onSubmitFeedback: (rating: CompanionMessageFeedbackRating) => void;
  rating: CompanionMessageFeedbackRating | null;
}) {
  return (
    <>
      <FeedbackButton
        active={rating === "positive"}
        disabled={disabled}
        icon={ThumbsUp}
        label="喜欢这条回复"
        onClick={() => onSubmitFeedback("positive")}
      />
      <FeedbackButton
        active={rating === "negative"}
        disabled={disabled}
        icon={ThumbsDown}
        label="不喜欢这条回复"
        onClick={() => onSubmitFeedback("negative")}
      />
    </>
  );
}

function FeedbackButton({
  active,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: typeof ThumbsUp;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={classNames(
        "moodmate-message__feedback-button",
        active && "moodmate-message__feedback-button--active",
      )}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" />
    </button>
  );
}
