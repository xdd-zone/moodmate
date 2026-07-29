import { MessageCircle, Settings, UsersRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@repo/ui/theme-toggle";

import { classNames } from "./class-names";

export type MoodmateNavigationKey = "chats" | "friends" | "settings";

type MoodmateNavigationRailProps = {
  active: MoodmateNavigationKey;
  profileControl?: ReactNode;
  unreadCount?: number;
};

const navigationItems = [
  { href: "/chats", icon: MessageCircle, key: "chats", label: "聊天" },
  { href: "/friends", icon: UsersRound, key: "friends", label: "通讯录" },
  { href: "/settings", icon: Settings, key: "settings", label: "设置" },
] satisfies Array<{
  href: string;
  icon: typeof MessageCircle;
  key: MoodmateNavigationKey;
  label: string;
}>;

export function MoodmateNavigationRail({
  active,
  profileControl,
  unreadCount = 0,
}: MoodmateNavigationRailProps) {
  return (
    <nav aria-label="主导航" className="moodmate-rail">
      <Link
        aria-label="MoodMate"
        className="moodmate-rail__logo"
        href="/chats"
        title="MoodMate"
      >
        M
      </Link>

      {navigationItems.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            aria-label={item.label}
            className={classNames(
              "moodmate-rail__item",
              isActive && "moodmate-rail__item--active",
            )}
            href={item.href}
            key={item.key}
            title={item.label}
          >
            <Icon aria-hidden="true" />
            {item.key === "chats" && unreadCount > 0 ? (
              <span className="moodmate-rail__badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
            <span className="moodmate-rail__tooltip" aria-hidden="true">
              {item.label}
            </span>
          </Link>
        );
      })}

      <div className="moodmate-rail__spacer" />
      <div className="moodmate-rail__control">
        <ThemeToggle className="moodmate-rail__item" variant="ghost" />
        <span className="moodmate-rail__tooltip" aria-hidden="true">
          切换主题
        </span>
      </div>
      {profileControl ? (
        <div className="moodmate-rail__profile">{profileControl}</div>
      ) : null}
    </nav>
  );
}
