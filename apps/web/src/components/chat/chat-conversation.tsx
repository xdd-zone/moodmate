"use client";

import type { ChatStatus, UIMessage } from "ai";
import { Bot, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const TYPEWRITER_INTERVAL_MS = 18;

interface ChatConversationProps {
  historicalAssistantMessageIds: readonly string[];
  messages: UIMessage[];
  status: ChatStatus;
}

function getMessageText(message: UIMessage): string {
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
  historicalAssistantMessageIds,
  messages,
  status,
}: ChatConversationProps) {
  const reducedMotion = usePrefersReducedMotion();
  const endRef = useRef<HTMLDivElement>(null);
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

  return (
    <div
      aria-label="与 MoodMate 的对话"
      className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6"
      role="log"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        {messages.length === 0 ? (
          <div className="flex max-w-[min(36rem,92%)] items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-subtle text-primary-strong">
              <Bot aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 rounded-md border border-border bg-surface px-4 py-3 text-sm leading-6">
              我在。今天想聊点什么？
            </div>
          </div>
        ) : null}

        {messages.map((message) => {
          const fullText = getMessageText(message);

          if (message.role === "assistant" && !fullText.trim()) {
            return null;
          }

          const isUser = message.role === "user";
          const visibleText = isUser
            ? fullText
            : (visibleAssistantTextById[message.id] ??
              sliceUnicodeText(fullText, 1));

          return (
            <div
              className={
                isUser
                  ? "ml-auto flex max-w-[min(36rem,88%)] justify-end"
                  : "flex max-w-[min(36rem,92%)] items-start gap-3"
              }
              key={message.id}
            >
              {isUser ? null : (
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-subtle text-primary-strong">
                  <Bot aria-hidden="true" className="size-4" />
                </span>
              )}
              <div
                className={
                  isUser
                    ? "min-w-0 whitespace-pre-wrap rounded-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground"
                    : "min-w-0 whitespace-pre-wrap rounded-md border border-border bg-surface px-4 py-3 text-sm leading-6"
                }
              >
                {isUser ? (
                  fullText
                ) : (
                  <>
                    <span aria-hidden="true">{visibleText}</span>
                    <span className="sr-only">{fullText}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {showLoading ? (
          <div
            className="flex items-center gap-3 text-sm text-muted"
            role="status"
          >
            <span className="grid size-9 place-items-center rounded-full bg-primary-subtle text-primary-strong">
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            </span>
            MoodMate 正在回复
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
    </div>
  );
}
