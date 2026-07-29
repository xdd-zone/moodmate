import type {
  AgentGroupChatListItem,
  CompanionConversationResponse,
  WebUserProfile,
} from "@repo/contracts";

import type {
  MoodmateAvatarPalette,
  MoodmateConversation,
  MoodmateProfile,
} from "@/src/components/moodmate/models";

const defaultAvatarPalette = { start: "#7c6bf5", end: "#22d3ee" };

const avatarPalettes = [
  defaultAvatarPalette,
  { start: "#f472b6", end: "#8b5cf6" },
  { start: "#34d399", end: "#0ea5e9" },
  { start: "#f59e0b", end: "#ef4444" },
] satisfies MoodmateAvatarPalette[];

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
});

function getPalette(value: string): MoodmateAvatarPalette {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  }

  return avatarPalettes[hash % avatarPalettes.length] ?? defaultAvatarPalette;
}

function formatTime(value: number | null | undefined) {
  return value ? timeFormatter.format(new Date(value)) : "";
}

function getMessagePreview(
  conversation: CompanionConversationResponse,
): string {
  return (
    conversation.messages.at(-1)?.content.trim() ||
    conversation.summary?.trim() ||
    "从一句你好开始"
  );
}

export function getCompanionProfile(
  conversation: CompanionConversationResponse,
): MoodmateProfile {
  const name = conversation.title?.trim() || "MoodMate";

  return {
    headline: "你的 AI 伴侣",
    id: conversation.conversationId,
    name,
    palette: getPalette(conversation.conversationId),
    status: "online",
  };
}

export function getCurrentUserProfile(
  profile: WebUserProfile,
): MoodmateProfile {
  return {
    headline: profile.email,
    id: profile.userId,
    name: profile.displayName,
    palette: getPalette(profile.userId),
  };
}

export function getGroupProfile(
  groupChat: AgentGroupChatListItem,
): MoodmateProfile {
  return {
    headline: `${groupChat.memberCount} 位成员`,
    id: groupChat.id,
    name: groupChat.title,
    palette: getPalette(groupChat.id),
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
    palette: getPalette(input.id),
    status: "online",
  };
}

export function toDirectConversation(
  conversation: CompanionConversationResponse,
): MoodmateConversation {
  const lastMessage = conversation.messages.at(-1);
  const profile = getCompanionProfile(conversation);

  return {
    avatar: profile,
    href: `/chats/direct/${conversation.conversationId}`,
    id: conversation.conversationId,
    kind: "direct",
    lastMessage: getMessagePreview(conversation),
    timeLabel: formatTime(lastMessage?.createdAtMs),
    title: profile.name,
    unreadCount: conversation.hasUnreadCareEvent ? 1 : undefined,
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
  direct: CompanionConversationResponse | undefined,
  groups: readonly AgentGroupChatListItem[],
) {
  const directTime = direct?.messages.at(-1)?.createdAtMs ?? -1;
  const newestGroup = groups.reduce<AgentGroupChatListItem | undefined>(
    (current, group) =>
      (group.lastMessageAtMs ?? -1) > (current?.lastMessageAtMs ?? -1)
        ? group
        : current,
    undefined,
  );

  if (direct && directTime >= (newestGroup?.lastMessageAtMs ?? -1)) {
    return `/chats/direct/${direct.conversationId}`;
  }

  if (newestGroup) {
    return `/chats/group/${newestGroup.id}`;
  }

  return direct ? `/chats/direct/${direct.conversationId}` : null;
}
