"use client";

import type { ComponentProps } from "react";
import { useSyncExternalStore } from "react";

import { cn } from "./lib/utils";
import {
  applyTheme,
  DEFAULT_THEME,
  getThemeSnapshot,
  subscribeToTheme,
  THEMES,
} from "./theme";

const themeLabels = {
  latte: "Latte",
  mocha: "Mocha",
} as const;

const themeOptionClassNames = {
  latte:
    "bg-primary text-primary-foreground hover:bg-primary-hover dark:bg-transparent dark:text-muted dark:hover:bg-surface dark:hover:text-foreground",
  mocha:
    "bg-transparent text-muted hover:bg-surface hover:text-foreground dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary-hover dark:hover:text-primary-foreground",
} as const;

type ThemeToggleProps = Omit<ComponentProps<"div">, "children">;

function getServerThemeSnapshot() {
  return DEFAULT_THEME;
}

export function ThemeToggle({ className, ...props }: ThemeToggleProps) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  return (
    <div
      {...props}
      aria-label={props["aria-label"] ?? "主题"}
      className={cn(
        "grid h-9 shrink-0 grid-cols-2 rounded-md border border-border bg-surface-muted p-0.5 shadow-control",
        className,
      )}
      role="group"
    >
      {THEMES.map((option) => {
        const isActive = option === theme;

        return (
          <button
            aria-pressed={isActive}
            className={cn(
              "min-w-[4.5rem] rounded-sm px-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              themeOptionClassNames[option],
            )}
            key={option}
            onClick={() => applyTheme(option)}
            type="button"
          >
            {themeLabels[option]}
          </button>
        );
      })}
    </div>
  );
}
