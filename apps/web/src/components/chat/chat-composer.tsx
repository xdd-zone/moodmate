"use client";

import { Button } from "@repo/ui/button";
import { Send, Square } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";

interface ChatComposerProps {
  isSending: boolean;
  onChange: (value: string) => void;
  onStop: () => void;
  onSubmit: () => void;
  value: string;
}

export function ChatComposer({
  isSending,
  onChange,
  onStop,
  onSubmit,
  value,
}: ChatComposerProps) {
  const canSubmit = Boolean(value.trim()) && !isSending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (canSubmit) {
      onSubmit();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();

      if (canSubmit) {
        onSubmit();
      }
    }
  }

  return (
    <form
      className="mx-auto flex w-full max-w-3xl items-end gap-2 border-t border-border bg-background px-4 py-3 sm:px-6"
      onSubmit={handleSubmit}
    >
      <label className="sr-only" htmlFor="chat-message">
        输入消息
      </label>
      <textarea
        className="max-h-36 min-h-11 min-w-0 flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2.5 text-base leading-6 text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        id="chat-message"
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder="和 MoodMate 说点什么"
        rows={1}
        value={value}
      />
      {isSending ? (
        <Button
          aria-label="停止生成"
          className="size-11 min-h-11"
          onClick={onStop}
          size="icon"
          title="停止生成"
          type="button"
          variant="secondary"
        >
          <Square aria-hidden="true" className="size-4 fill-current" />
        </Button>
      ) : (
        <Button
          aria-label="发送消息"
          className="size-11 min-h-11"
          disabled={!canSubmit}
          size="icon"
          title="发送消息"
          type="submit"
        >
          <Send aria-hidden="true" className="size-4" />
        </Button>
      )}
    </form>
  );
}
