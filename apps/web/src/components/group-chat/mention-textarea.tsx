"use client";

import type { AgentGroupChatMember } from "@repo/contracts";
import { Bot } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

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

export type MentionTextareaHandle = {
  insertMention: (member?: AgentGroupChatMember) => void;
};

export const MentionTextarea = forwardRef<
  MentionTextareaHandle,
  MentionTextareaProps
>(function MentionTextarea(
  { value, onChange, onSend, members, disabled },
  ref,
) {
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

  useImperativeHandle(
    ref,
    () => ({
      insertMention(member) {
        const textarea = textareaRef.current;
        const selectionStart = textarea?.selectionStart ?? value.length;
        const selectionEnd = textarea?.selectionEnd ?? selectionStart;
        const needsSpace =
          selectionStart > 0 && !/\s/u.test(value[selectionStart - 1] ?? "");
        const leadingSpace = needsSpace ? " " : "";
        const mentionText = member ? `@${member.name} ` : "@";
        const insertText = leadingSpace + mentionText;
        const nextValue =
          value.slice(0, selectionStart) +
          insertText +
          value.slice(selectionEnd);
        const cursor = selectionStart + insertText.length;

        pendingCursorRef.current = cursor;
        onChange(nextValue);
        setMentionIndex(0);
        setMentionContext(
          member
            ? null
            : {
                start: selectionStart + leadingSpace.length,
                end: cursor,
                query: "",
              },
        );
      },
    }),
    [onChange, value],
  );

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }, [value]);

  function refreshMentionContext(nextValue: string, cursor: number) {
    setMentionContext(getMentionContext(nextValue, cursor));
  }

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const nextValue = event.target.value;
    onChange(nextValue);
    refreshMentionContext(nextValue, event.target.selectionStart);
  }

  function selectMention(member: AgentGroupChatMember) {
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
          selectMention(candidate);
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

    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      setMentionContext(null);
      onSend();
    }
  }

  return (
    <div className="moodmate-mention">
      {isMenuOpen ? (
        <div className="moodmate-mention__menu moodmate-scroll">
          {mentionCandidates.length === 0 ? (
            <p className="moodmate-mention__empty">没有匹配的群成员</p>
          ) : (
            <ul>
              {mentionCandidates.map((member, index) => (
                <li key={member.id}>
                  <button
                    aria-current={index === mentionIndex}
                    onClick={() => selectMention(member)}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setMentionIndex(index)}
                    type="button"
                  >
                    <span aria-hidden className="moodmate-mention__avatar">
                      <Bot />
                    </span>
                    <span className="moodmate-mention__person">
                      <strong>{member.name}</strong>
                      {member.headline ? (
                        <small>{member.headline}</small>
                      ) : null}
                    </span>
                    <span className="moodmate-mention__label">
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
});
