"use client";

import {
  AtSign,
  BellOff,
  MessageCircle,
  Power,
  UserRound,
  X,
} from "lucide-react";

import type { AvatarSize } from "@/src/components/moodmate/avatar";
import { MoodmateAvatarMenu } from "@/src/components/moodmate/avatar-menu";
import type { MoodmateProfile } from "@/src/components/moodmate/models";

type FriendAvatarMenuProps = {
  onMention?: () => void;
  onRemove?: () => void;
  onSurface?: boolean;
  profile: MoodmateProfile;
  profileHref?: string;
  showStatus?: boolean;
  size?: AvatarSize;
};

export function FriendAvatarMenu({
  onMention,
  onRemove,
  onSurface = false,
  profile,
  profileHref,
  showStatus = false,
  size = "sm",
}: FriendAvatarMenuProps) {
  return (
    <MoodmateAvatarMenu
      compact
      items={[
        {
          disabled: !profileHref,
          href: profileHref,
          icon: UserRound,
          label: "查看朋友档案",
        },
        {
          disabled: true,
          icon: MessageCircle,
          label: "发起私聊暂未开放",
        },
        ...(onMention
          ? [
              {
                icon: AtSign,
                label: `在群里 @ ${profile.name}`,
                onSelect: onMention,
              },
            ]
          : []),
        {
          disabled: true,
          icon: BellOff,
          label: "消息免打扰暂未开放",
        },
        {
          danger: true,
          disabled: !onRemove,
          icon: onRemove ? X : Power,
          label: onRemove ? "移出群组" : "结束陪伴暂未开放",
          onSelect: onRemove,
          separatorBefore: true,
        },
      ]}
      label={`${profile.name}的朋友菜单`}
      onSurface={onSurface}
      profile={profile}
      showStatus={showStatus}
      size={size}
    />
  );
}
