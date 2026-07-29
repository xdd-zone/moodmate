"use client";

import type { WebUserProfile } from "@repo/contracts";
import { LogOut, Settings } from "lucide-react";

import { clearClientSession } from "@/src/auth/client-session";
import { MoodmateAvatarMenu } from "@/src/components/moodmate/avatar-menu";
import { MoodmateNavigationRail } from "@/src/components/moodmate/navigation-rail";

import { getFriendsUserProfile } from "./friend-models";

type FriendsNavigationProps = {
  profile: WebUserProfile;
};

export function FriendsNavigation({ profile }: FriendsNavigationProps) {
  function handleLogout() {
    clearClientSession();
    window.location.replace("/");
  }

  return (
    <MoodmateNavigationRail
      active="friends"
      profileControl={
        <MoodmateAvatarMenu
          items={[
            {
              href: "/settings",
              icon: Settings,
              label: "个人资料与设置",
            },
            {
              danger: true,
              icon: LogOut,
              label: "退出登录",
              onSelect: handleLogout,
              separatorBefore: true,
            },
          ]}
          label="个人菜单"
          profile={getFriendsUserProfile(profile)}
        />
      }
    />
  );
}
