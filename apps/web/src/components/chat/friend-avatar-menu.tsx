"use client";

import {
  AtSign,
  BellOff,
  MessageCircle,
  Power,
  UserRound,
  X,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createDirectChatMutationOptions } from "@/src/api/direct-chat.query";

import type { AvatarSize } from "@/src/components/moodmate/avatar";
import { MoodmateAvatarMenu } from "@/src/components/moodmate/avatar-menu";
import type { MoodmateProfile } from "@/src/components/moodmate/models";
import { MoodmateToast } from "@/src/components/moodmate/toast";

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const chatMutation = useMutation(
    createDirectChatMutationOptions(queryClient),
  );
  const [chatError, setChatError] = useState<string | null>(null);
  return (
    <>
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
            disabled: chatMutation.isPending || profile.status === "offline",
            icon: MessageCircle,
            label: "发起私聊",
            onSelect: () => {
              setChatError(null);
              chatMutation.mutate(profile.id, {
                onSuccess: (data) =>
                  router.push(`/chats/direct/${data.conversation.id}`),
                onError: (error) =>
                  setChatError(
                    error instanceof Error && error.message
                      ? error.message
                      : "无法发起私聊",
                  ),
              });
            },
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
      {chatError ? <MoodmateToast message={chatError} /> : null}
    </>
  );
}
