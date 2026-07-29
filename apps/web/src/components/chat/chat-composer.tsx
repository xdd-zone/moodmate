"use client";

import { Send, Square } from "lucide-react";
import { useEffect, useRef } from "react";
import type { FormEvent, KeyboardEvent } from "react";

interface ChatComposerProps {
  isSending: boolean;
  onChange: (value: string) => void;
  onStop: () => void;
  onSubmit: () => void;
  placeholder?: string;
  value: string;
}

export function ChatComposer({
  isSending,
  onChange,
  onStop,
  onSubmit,
  placeholder = "输入消息",
  value,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = Boolean(value.trim()) && !isSending;

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }, [value]);

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
    <form className="moodmate-composer" onSubmit={handleSubmit}>
      <div className="moodmate-composer__box">
        <label className="sr-only" htmlFor="chat-message">
          输入消息
        </label>
        <textarea
          id="chat-message"
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={`${placeholder}，Enter 发送，Shift+Enter 换行`}
          ref={textareaRef}
          rows={1}
          value={value}
        />
        {isSending ? (
          <button
            aria-label="停止生成"
            className="moodmate-composer__send"
            onClick={onStop}
            title="停止生成"
            type="button"
          >
            <Square aria-hidden="true" />
          </button>
        ) : (
          <button
            aria-label="发送消息"
            className="moodmate-composer__send"
            disabled={!canSubmit}
            title="发送消息"
            type="submit"
          >
            <Send aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  );
}
