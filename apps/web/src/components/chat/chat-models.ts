import type {
  AgentGroupChatListItem,
  DirectChatListItem,
} from "@repo/contracts";

import type {
  MoodmateConversation,
  MoodmateProfile,
} from "@/src/components/moodmate/models";
import { getMoodmateAvatarPalette } from "@/src/components/moodmate/models";

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
});

function formatTime(value: number | null | undefined) {
  return value ? timeFormatter.format(new Date(value)) : "";
}

function getMessagePreview(conversation: DirectChatListItem): string {
  return conversation.summary?.trim() || `${conversation.messageCount} 条消息`;
}

export function getCompanionProfile(
  conversation: DirectChatListItem,
): MoodmateProfile {
  return {
    headline: conversation.agent.headline?.trim() || "MoodMate 朋友",
    id: conversation.agent.id,
    name: conversation.agent.name,
    palette: getMoodmateAvatarPalette(conversation.agent.id),
    status: conversation.agent.status === "active" ? "online" : "offline",
  };
}

export function getGroupProfile(
  groupChat: AgentGroupChatListItem,
): MoodmateProfile {
  return {
    headline: `${groupChat.memberCount} 位成员`,
    id: groupChat.id,
    name: groupChat.title,
    palette: getMoodmateAvatarPalette(groupChat.id),
  };
}

export function getMemberProfile(input: {
  headline?: string | null;
  id: string;
  name: string;
}): MoodmateProfile {
  return {
    headline: input.headline?.trim() || "群聊成员",
    id: input.id,
    name: input.name,
    palette: getMoodmateAvatarPalette(input.id),
    status: "online",
  };
}

export function toDirectConversation(
  conversation: DirectChatListItem,
): MoodmateConversation {
  const profile = getCompanionProfile(conversation);

  return {
    avatar: profile,
    href: `/chats/direct/${conversation.id}`,
    id: conversation.id,
    kind: "direct",
    lastMessage: getMessagePreview(conversation),
    timeLabel: formatTime(conversation.lastMessageAtMs),
    title: profile.name,
  };
}

export function toGroupConversation(
  groupChat: AgentGroupChatListItem,
): MoodmateConversation {
  return {
    avatar: getGroupProfile(groupChat),
    href: `/chats/group/${groupChat.id}`,
    id: groupChat.id,
    kind: "group",
    lastMessage:
      groupChat.summary?.trim() || `${groupChat.messageCount} 条消息`,
    timeLabel: formatTime(groupChat.lastMessageAtMs),
    title: groupChat.title,
  };
}

export function getLatestConversationHref(
  directs: readonly DirectChatListItem[],
  groups: readonly AgentGroupChatListItem[],
) {
  const direct = directs.reduce<DirectChatListItem | undefined>(
    (current, item) =>
      (item.lastMessageAtMs ?? item.updatedAtMs) >
      (current?.lastMessageAtMs ?? current?.updatedAtMs ?? -1)
        ? item
        : current,
    undefined,
  );
  const directTime = direct?.lastMessageAtMs ?? direct?.updatedAtMs ?? -1;
  const newestGroup = groups.reduce<AgentGroupChatListItem | undefined>(
    (current, group) =>
      (group.lastMessageAtMs ?? -1) > (current?.lastMessageAtMs ?? -1)
        ? group
        : current,
    undefined,
  );

  if (direct && directTime >= (newestGroup?.lastMessageAtMs ?? -1)) {
    return `/chats/direct/${direct.id}`;
  }

  if (newestGroup) {
    return `/chats/group/${newestGroup.id}`;
  }

  return direct ? `/chats/direct/${direct.id}` : null;
}
