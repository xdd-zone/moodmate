"use client";

import {
  Heart,
  Layers3,
  Palette,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { useRef, useState } from "react";

import { useAuthenticatedApp } from "@/src/components/app/authenticated-app-layout";

import {
  AppearancePanel,
  CarePanel,
  GeneralPanel,
  MemoryPanel,
  ProfilePanel,
} from "./settings-panels";

type SettingsPanelId = "profile" | "general" | "memory" | "care" | "appearance";

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

export function SettingsWorkspace() {
  const { logout, profile } = useAuthenticatedApp();
  const contentRef = useRef<HTMLDivElement>(null);
  const [activePanel, setActivePanel] = useState<SettingsPanelId>("profile");
  const [visitedPanels, setVisitedPanels] = useState<Set<SettingsPanelId>>(
    () => new Set(["profile"]),
  );
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
    <div className="moodmate-settings-layout">
      <aside className="moodmate-list">{menu}</aside>
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
              <ProfilePanel onLogout={logout} profile={profile} />
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
    </div>
  );
}
