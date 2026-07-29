import Link from "next/link";

import { MoodmateAvatar } from "./avatar";
import { classNames } from "./class-names";
import type { MoodmateConversation } from "./models";

type MoodmateConversationItemProps = {
  active?: boolean;
  conversation: MoodmateConversation;
};

export function MoodmateConversationItem({
  active = false,
  conversation,
}: MoodmateConversationItemProps) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={classNames(
        "moodmate-conversation",
        active && "moodmate-conversation--active",
        conversation.muted && "moodmate-conversation--muted",
      )}
      href={conversation.href}
    >
      <MoodmateAvatar
        isGroup={conversation.kind === "group"}
        profile={conversation.avatar}
        showStatus={conversation.kind === "direct"}
      />
      <span className="moodmate-conversation__body">
        <span className="moodmate-conversation__name">
          {conversation.title}
        </span>
        <span className="moodmate-conversation__last">
          {conversation.lastSenderName ? (
            <span className="moodmate-conversation__sender">
              {conversation.lastSenderName}:{" "}
            </span>
          ) : null}
          {conversation.lastMessage}
        </span>
      </span>
      <span className="moodmate-conversation__meta">
        <time className="moodmate-conversation__time">
          {conversation.timeLabel}
        </time>
        {conversation.unreadCount ? (
          <span
            aria-label={`${conversation.unreadCount} 条未读消息`}
            className="moodmate-conversation__unread"
          >
            {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
