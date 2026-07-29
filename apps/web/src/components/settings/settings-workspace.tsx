"use client";

import type { WebSession, WebUserProfile } from "@repo/contracts";
import {
  Heart,
  Layers3,
  LogOut,
  Palette,
  Settings,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { useRef, useState } from "react";

import { clearClientSession } from "@/src/auth/client-session";
import { MoodmateAppShell } from "@/src/components/moodmate/app-shell";
import { MoodmateAvatarMenu } from "@/src/components/moodmate/avatar-menu";
import {
  getMoodmateAvatarPalette,
  type MoodmateProfile,
} from "@/src/components/moodmate/models";
import { MoodmateNavigationRail } from "@/src/components/moodmate/navigation-rail";

import {
  AppearancePanel,
  CarePanel,
  GeneralPanel,
  MemoryPanel,
  ProfilePanel,
} from "./settings-panels";

type SettingsPanelId = "profile" | "general" | "memory" | "care" | "appearance";

type SettingsWorkspaceProps = {
  profile: WebUserProfile;
  session: WebSession;
};

const settingsItems = [
  { icon: UserRound, id: "profile", label: "个人资料" },
  { icon: SlidersHorizontal, id: "general", label: "通用" },
  { icon: Layers3, id: "memory", label: "记忆管理" },
  { icon: Heart, id: "care", label: "主动关怀" },
  { icon: Palette, id: "appearance", label: "外观" },
] satisfies Array<{
  icon: typeof UserRound;
  id: SettingsPanelId;
  label: string;
}>;

function getSettingsUserProfile(profile: WebUserProfile): MoodmateProfile {
  return {
    headline: profile.email,
    id: profile.userId,
    name: profile.displayName,
    palette: getMoodmateAvatarPalette(profile.userId),
  };
}

export function SettingsWorkspace({
  profile,
  session,
}: SettingsWorkspaceProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [activePanel, setActivePanel] = useState<SettingsPanelId>("profile");
  const [visitedPanels, setVisitedPanels] = useState<Set<SettingsPanelId>>(
    () => new Set(["profile"]),
  );
  const userProfile = getSettingsUserProfile(profile);

  function handleLogout() {
    clearClientSession();
    window.location.replace("/");
  }

  function selectPanel(panel: SettingsPanelId) {
    setActivePanel(panel);
    setVisitedPanels((current) => {
      if (current.has(panel)) return current;

      const next = new Set(current);
      next.add(panel);
      return next;
    });
    contentRef.current?.scrollTo({ top: 0 });
  }

  const navigation = (
    <MoodmateNavigationRail
      active="settings"
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
          profile={userProfile}
        />
      }
    />
  );

  const menu = (
    <>
      <header className="moodmate-list__header moodmate-settings-menu__header">
        <div className="moodmate-list__title-row">
          <h1 className="moodmate-list__title">设置</h1>
        </div>
      </header>
      <nav aria-label="设置分组" className="moodmate-settings-menu">
        {settingsItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;

          return (
            <button
              aria-current={isActive ? "page" : undefined}
              className={
                isActive
                  ? "moodmate-settings-menu__item moodmate-settings-menu__item--active"
                  : "moodmate-settings-menu__item"
              }
              key={item.id}
              onClick={() => selectPanel(item.id)}
              type="button"
            >
              <Icon aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </>
  );

  return (
    <MoodmateAppShell
      className="moodmate-settings-app"
      list={menu}
      navigation={navigation}
    >
      <section className="moodmate-settings">
        <nav aria-label="设置分组" className="moodmate-settings-mobile-menu">
          {settingsItems.map((item) => (
            <button
              aria-current={activePanel === item.id ? "page" : undefined}
              className={
                activePanel === item.id
                  ? "moodmate-settings-mobile-menu__item moodmate-settings-mobile-menu__item--active"
                  : "moodmate-settings-mobile-menu__item"
              }
              key={item.id}
              onClick={() => selectPanel(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div
          className="moodmate-scroll moodmate-settings__body"
          ref={contentRef}
        >
          {visitedPanels.has("profile") ? (
            <div hidden={activePanel !== "profile"}>
              <ProfilePanel
                onLogout={handleLogout}
                profile={profile}
                session={session}
              />
            </div>
          ) : null}
          {visitedPanels.has("general") ? (
            <div hidden={activePanel !== "general"}>
              <GeneralPanel />
            </div>
          ) : null}
          {visitedPanels.has("memory") ? (
            <div hidden={activePanel !== "memory"}>
              <MemoryPanel />
            </div>
          ) : null}
          {visitedPanels.has("care") ? (
            <div hidden={activePanel !== "care"}>
              <CarePanel />
            </div>
          ) : null}
          {visitedPanels.has("appearance") ? (
            <div hidden={activePanel !== "appearance"}>
              <AppearancePanel />
            </div>
          ) : null}
        </div>
      </section>
    </MoodmateAppShell>
  );
}
