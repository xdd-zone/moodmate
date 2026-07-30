export type MoodmateAvatarStatus = "online" | "busy" | "offline";
export type MoodmateConversationKind = "direct" | "group";

export type MoodmateAvatarPalette = {
  end: string;
  start: string;
};

export type MoodmateProfile = {
  headline: string;
  id: string;
  imageUrl?: string;
  name: string;
  palette: MoodmateAvatarPalette;
  status?: MoodmateAvatarStatus;
};

export type MoodmateConversation = {
  avatar: MoodmateProfile;
  href: string;
  id: string;
  kind: MoodmateConversationKind;
  lastMessage: string;
  lastSenderName?: string;
  muted?: boolean;
  pinned?: boolean;
  timeLabel: string;
  title: string;
  unreadCount?: number;
};

const defaultAvatarPalette = { start: "#7c6bf5", end: "#22d3ee" };

const avatarPalettes = [
  defaultAvatarPalette,
  { start: "#f472b6", end: "#8b5cf6" },
  { start: "#34d399", end: "#0ea5e9" },
  { start: "#f59e0b", end: "#ef4444" },
] satisfies MoodmateAvatarPalette[];

export function getMoodmateAvatarPalette(value: string): MoodmateAvatarPalette {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  }

  return avatarPalettes[hash % avatarPalettes.length] ?? defaultAvatarPalette;
}

export const moodmatePrototypeProfiles = {
  linXi: {
    headline: "陪伴倾听型 · 温柔而有分寸",
    id: "lin-xi",
    name: "林夕",
    palette: { start: "#7c6bf5", end: "#22d3ee" },
    status: "online",
  },
  nuanNuan: {
    headline: "情感支持型 · 给你确定的回应",
    id: "nuan-nuan",
    name: "暖暖",
    palette: { start: "#fb7185", end: "#f43f5e" },
    status: "busy",
  },
  suiBo: {
    headline: "自由陪伴型 · 和你顺流而行",
    id: "sui-bo",
    name: "随波",
    palette: { start: "#34d399", end: "#0ea5e9" },
    status: "offline",
  },
  user: {
    headline: "MoodMate 用户",
    id: "current-user",
    name: "喜东东",
    palette: { start: "#f59e0b", end: "#ef4444" },
  },
} satisfies Record<string, MoodmateProfile>;

export const moodmatePrototypeConversations = [
  {
    avatar: moodmatePrototypeProfiles.linXi,
    href: "/chats/direct/lin-xi",
    id: "direct-lin-xi",
    kind: "direct",
    lastMessage: "我在。你可以慢慢说。",
    timeLabel: "21:04",
    title: "林夕",
    unreadCount: 2,
  },
  {
    avatar: {
      headline: "三位朋友陪你聊聊",
      id: "late-night-group",
      name: "深夜树洞小组",
      palette: { start: "#f472b6", end: "#8b5cf6" },
    },
    href: "/chats/group/late-night-group",
    id: "group-late-night",
    kind: "group",
    lastMessage: "今晚先不急着找答案。",
    lastSenderName: "暖暖",
    timeLabel: "20:38",
    title: "深夜树洞小组",
    unreadCount: 1,
  },
  {
    avatar: moodmatePrototypeProfiles.suiBo,
    href: "/chats/direct/sui-bo",
    id: "direct-sui-bo",
    kind: "direct",
    lastMessage: "等你想聊的时候再来。",
    muted: true,
    timeLabel: "昨天",
    title: "随波",
  },
] satisfies MoodmateConversation[];
