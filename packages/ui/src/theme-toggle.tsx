"use client";

import { Moon, Sun } from "lucide-react";
import type { ComponentProps } from "react";
import { useSyncExternalStore } from "react";

import { Button } from "./button";
import {
  applyTheme,
  DEFAULT_THEME,
  getThemeSnapshot,
  subscribeToTheme,
} from "./theme";

type ThemeToggleProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "onClick" | "size" | "type"
>;

function getServerThemeSnapshot() {
  return DEFAULT_THEME;
}

export function ThemeToggle({
  variant = "secondary",
  ...props
}: ThemeToggleProps) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const nextTheme = theme === "latte" ? "mocha" : "latte";
  const label = nextTheme === "mocha" ? "切换到深色主题" : "切换到浅色主题";

  return (
    <Button
      {...props}
      aria-label={props["aria-label"] ?? label}
      aria-pressed={theme === "mocha"}
      onClick={() => applyTheme(nextTheme)}
      size="icon"
      title={props.title ?? label}
      type="button"
      variant={variant}
    >
      {nextTheme === "mocha" ? (
        <Moon aria-hidden="true" className="size-4" />
      ) : (
        <Sun aria-hidden="true" className="size-4" />
      )}
    </Button>
  );
}
