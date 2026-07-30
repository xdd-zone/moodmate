"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
});

const fullDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function isSameLocalDate(left: number, right: number): boolean {
  const leftDate = new Date(left);
  const rightDate = new Date(right);

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

export function formatMessageTime(createdAtMs: number): string {
  return timeFormatter.format(new Date(createdAtMs));
}

export function ChatDateDivider({ createdAtMs }: { createdAtMs: number }) {
  return (
    <div className="moodmate-message-date">
      <span>{formatMessageDate(createdAtMs)}</span>
    </div>
  );
}

export function ChatTypingDots({ label }: { label: string }) {
  return (
    <span aria-label={label} className="moodmate-typing-dots" role="status">
      <i />
      <i />
      <i />
    </span>
  );
}

export function ChatHeaderTyping({ label }: { label: string }) {
  return (
    <span className="moodmate-chat__typing" role="status">
      <ChatTypingDots label={label} />
      <span>{label}</span>
    </span>
  );
}

export function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const label = copied ? "已复制" : "复制消息";

  async function handleCopy() {
    if (await copyText(text)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } else {
      setCopied(false);
    }
  }

  return (
    <button
      aria-label={label}
      className="moodmate-message__feedback-button"
      onClick={() => void handleCopy()}
      title={label}
      type="button"
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </button>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();

    try {
      return document.execCommand("copy");
    } finally {
      textarea.remove();
    }
  }
}

function formatMessageDate(createdAtMs: number): string {
  const date = new Date(createdAtMs);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameLocalDate(createdAtMs, today.getTime())) return "今天";
  if (isSameLocalDate(createdAtMs, yesterday.getTime())) return "昨天";

  return date.getFullYear() === today.getFullYear()
    ? dateFormatter.format(date)
    : fullDateFormatter.format(date);
}
