"use client";

import type { AgentGroupChatMember } from "@repo/contracts";
import { Bot } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type MentionContext = {
  start: number;
  end: number;
  query: string;
};

/**
 * 解析光标前最后一个独立 @ 片段：@ 须在文本开头或空白符后，
 * 命中返回 { start, end, query }，否则 null。避免把 name@example.com 识别成提及。
 */
export function getMentionContext(
  value: string,
  cursor: number,
): MentionContext | null {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(^|\s)@([^\s@]*)$/);

  if (!match) {
    return null;
  }

  const query = match[2] ?? "";
  // match.index 指向前导字符（^ 或空白）；@ 起点需跳过前导空白（开头时无前导字符）。
  const leading = match[1] ?? "";
  const start = (match.index ?? 0) + leading.length;

  return { start, end: cursor, query };
}

type MentionTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  members: AgentGroupChatMember[];
  disabled?: boolean;
};

export function MentionTextarea({
  value,
  onChange,
  onSend,
  members,
  disabled,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionContext, setMentionContext] = useState<MentionContext | null>(
    null,
  );
  const [mentionIndex, setMentionIndex] = useState(0);
  // 插入提及后需要把光标移到插入文本之后；React 受控更新后 DOM 才刷新，用该 ref 在下一帧同步。
  const pendingCursorRef = useRef<number | null>(null);

  const isMenuOpen = mentionContext !== null;

  // 成员集合的稳定签名：父组件每次 render 都用 filter 产生新数组引用，
  // 直接以 members 引用做 effect 依赖会导致浮层刚打开就被关掉（闪烁）。
  // 只有成员真正变化（切群 / 增删成员）时该签名才变。
  const membersKey = useMemo(
    () => members.map((member) => member.id).join(","),
    [members],
  );

  const mentionCandidates = useMemo(() => {
    if (!mentionContext) {
      return [];
    }

    const query = mentionContext.query.toLowerCase();

    if (query.length === 0) {
      return members;
    }

    return members.filter((member) => {
      const name = member.name.toLowerCase();
      const headline = member.headline?.toLowerCase() ?? "";
      return name.includes(query) || headline.includes(query);
    });
  }, [members, mentionContext]);

  // 切换群聊（成员集合变化）时关闭浮层，避免旧候选残留。
  // 依赖 membersKey 而非 members 引用，否则父组件每次 render 都会误关浮层。
  useEffect(() => {
    setMentionContext(null);
  }, [membersKey]);

  // 候选集变化时把选中项夹回有效范围。
  useEffect(() => {
    setMentionIndex(0);
  }, [mentionContext?.query]);

  // 受控更新后同步光标位置。
  useEffect(() => {
    if (pendingCursorRef.current === null) {
      return;
    }

    const cursor = pendingCursorRef.current;
    pendingCursorRef.current = null;

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    }
  }, [value]);

  function refreshMentionContext(nextValue: string, cursor: number) {
    setMentionContext(getMentionContext(nextValue, cursor));
  }

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const nextValue = event.target.value;
    onChange(nextValue);
    refreshMentionContext(nextValue, event.target.selectionStart);
  }

  function insertMention(member: AgentGroupChatMember) {
    if (!mentionContext) {
      return;
    }

    const insertText = `@${member.name} `;
    const nextValue =
      value.slice(0, mentionContext.start) +
      insertText +
      value.slice(mentionContext.end);

    pendingCursorRef.current = mentionContext.start + insertText.length;
    setMentionContext(null);
    onChange(nextValue);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (isMenuOpen && mentionCandidates.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionCandidates.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex(
          (prev) =>
            (prev - 1 + mentionCandidates.length) % mentionCandidates.length,
        );
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const candidate = mentionCandidates[mentionIndex];
        if (candidate) {
          insertMention(candidate);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setMentionContext(null);
        return;
      }
    }

    if (isMenuOpen && event.key === "Escape") {
      event.preventDefault();
      setMentionContext(null);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      setMentionContext(null);
      onSend();
    }
  }

  return (
    <div className="relative w-full flex-1">
      {isMenuOpen ? (
        <div className="absolute bottom-full left-0 z-30 mb-2 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
          {mentionCandidates.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">没有匹配的群成员</p>
          ) : (
            <ul className="grid gap-0.5 p-1">
              {mentionCandidates.map((member, index) => (
                <li key={member.id}>
                  <button
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left outline-none transition-colors ${
                      index === mentionIndex
                        ? "bg-primary/12"
                        : "hover:bg-surface-muted"
                    }`}
                    onClick={() => insertMention(member)}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setMentionIndex(index)}
                    type="button"
                  >
                    <span
                      aria-hidden
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"
                    >
                      <Bot className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {member.name}
                      </span>
                      {member.headline ? (
                        <span className="block truncate text-xs text-muted">
                          {member.headline}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      @{member.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <textarea
        className="min-h-[44px] w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-focus"
        disabled={disabled}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="说点什么，@ 提及成员，Enter 发送，Shift+Enter 换行"
        ref={textareaRef}
        rows={1}
        value={value}
      />
    </div>
  );
}
