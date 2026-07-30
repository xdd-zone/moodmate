"use client";

import { BellOff, Pin } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import type { MouseEvent } from "react";

import { MoodmateAvatar } from "./avatar";
import { classNames } from "./class-names";
import {
  MoodmateConversationMenu,
  type MoodmateConversationMenuItem,
  type MoodmateMenuAnchor,
} from "./conversation-menu";
import type { MoodmateConversation } from "./models";

type MoodmateConversationItemProps = {
  active?: boolean;
  conversation: MoodmateConversation;
  menuItems?: MoodmateConversationMenuItem[];
  menuLabel?: string;
  onNavigate?: () => void;
};

export function MoodmateConversationItem({
  active = false,
  conversation,
  menuItems,
  menuLabel,
  onNavigate,
}: MoodmateConversationItemProps) {
  const [anchor, setAnchor] = useState<MoodmateMenuAnchor | null>(null);
  const hasMenu = Boolean(menuItems && menuItems.length > 0);

  const closeMenu = useCallback(() => setAnchor(null), []);

  function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
    if (!hasMenu) return;

    event.preventDefault();
    setAnchor({ left: event.clientX, top: event.clientY });
  }

  return (
    <div
      className="moodmate-conversation-row"
      onContextMenu={handleContextMenu}
    >
      <Link
        aria-current={active ? "page" : undefined}
        className={classNames(
          "moodmate-conversation",
          active && "moodmate-conversation--active",
          conversation.muted && "moodmate-conversation--muted",
        )}
        href={conversation.href}
        onClick={onNavigate}
      >
        <MoodmateAvatar
          isGroup={conversation.kind === "group"}
          profile={conversation.avatar}
          showStatus={conversation.kind === "direct"}
        />
        <span className="moodmate-conversation__body">
          <span className="moodmate-conversation__name-row">
            <span className="moodmate-conversation__name">
              {conversation.title}
            </span>
            {conversation.pinned ? (
              <span className="moodmate-conversation__state" title="已置顶">
                <Pin aria-hidden="true" />
                <span className="sr-only">已置顶</span>
              </span>
            ) : null}
            {conversation.muted ? (
              <span className="moodmate-conversation__state" title="消息免打扰">
                <BellOff aria-hidden="true" />
                <span className="sr-only">消息免打扰</span>
              </span>
            ) : null}
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
      {hasMenu && menuItems ? (
        <MoodmateConversationMenu
          anchor={anchor}
          items={menuItems}
          label={menuLabel ?? `${conversation.title}的会话菜单`}
          onClose={closeMenu}
        />
      ) : null}
    </div>
  );
}
