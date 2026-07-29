import type { UserAgent, WebUserProfile } from "@repo/contracts";

import {
  getMoodmateAvatarPalette,
  type MoodmateProfile,
} from "@/src/components/moodmate/models";

export type FriendFilter = "all" | "archived" | "guide" | "listener";

export const friendFilters = [
  { key: "all", label: "全部" },
  { key: "listener", label: "陪伴倾听" },
  { key: "guide", label: "理性引导" },
  { key: "archived", label: "已归档" },
] satisfies Array<{ key: FriendFilter; label: string }>;

export const friendProfilePlaceholders = {
  memories: [
    { importance: 5, label: "事件", text: "你最近在推进一项重要计划。" },
    { importance: 3, label: "偏好", text: "你更喜欢在安静的时候慢慢聊。" },
    { importance: 2, label: "人物", text: "你提到过一位很久没联系的朋友。" },
  ],
  stats: [
    { label: "相识天数", value: "128" },
    { label: "对话消息", value: "1,240" },
    { label: "记住的事", value: "32" },
  ],
} as const;

export function getFriendProfile(agent: UserAgent): MoodmateProfile {
  return {
    headline: agent.headline?.trim() || "MoodMate 朋友",
    id: agent.id,
    name: agent.name,
    palette: getMoodmateAvatarPalette(agent.id),
    status: agent.status === "active" ? "online" : "offline",
  };
}

export function getFriendsUserProfile(
  profile: WebUserProfile,
): MoodmateProfile {
  return {
    headline: profile.email,
    id: profile.userId,
    name: profile.displayName,
    palette: getMoodmateAvatarPalette(profile.userId),
  };
}

export function getFriendTags(agent: UserAgent): string[] {
  const content = [
    agent.headline,
    agent.description,
    agent.personaPrompt,
    agent.tonePrompt,
  ]
    .filter(Boolean)
    .join(" ");

  if (/理性|引导|拆解|思考|教练/u.test(content)) {
    return ["理性引导", "清晰拆解"];
  }

  return ["陪伴倾听", "温和回应"];
}

export function matchesFriendFilter(
  agent: UserAgent,
  filter: FriendFilter,
): boolean {
  if (filter === "all") return agent.status === "active";
  if (filter === "archived") return agent.status === "archived";

  return (
    getFriendTags(agent)[0] === (filter === "guide" ? "理性引导" : "陪伴倾听")
  );
}
