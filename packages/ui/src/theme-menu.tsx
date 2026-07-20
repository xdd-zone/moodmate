"use client";

import type { ComponentProps, SVGProps } from "react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Button } from "./button";
import { cn } from "./lib/utils";
import {
  applyTheme,
  DEFAULT_THEME,
  getThemeSnapshot,
  subscribeToTheme,
  type ThemeName,
} from "./theme";

// 图标 path 直取自设计稿 admin-console.html 的 THEME_SUN / THEME_MOON / tick，
// 保持与设计稿右上角主题切换一致，避免引入额外图标依赖。
function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      {...props}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
    </svg>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.4}
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const THEME_OPTIONS: ReadonlyArray<{ label: string; value: ThemeName }> = [
  { label: "浅色 Latte", value: "latte" },
  { label: "深色 Mocha", value: "mocha" },
];

function getServerThemeSnapshot() {
  return DEFAULT_THEME;
}

function ThemeGlyph({
  className,
  theme,
}: {
  className?: string;
  theme: ThemeName;
}) {
  return theme === "mocha" ? (
    <MoonIcon className={className} />
  ) : (
    <SunIcon className={className} />
  );
}

type ThemeMenuProps = Omit<ComponentProps<"div">, "children">;

export function ThemeMenu({ className, ...props }: ThemeMenuProps) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={cn("relative", className)} ref={containerRef} {...props}>
      <Button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="切换主题"
        className={cn(
          "size-9 min-h-9 p-0",
          open && "ring-1 ring-border-strong",
        )}
        onClick={() => setOpen((value) => !value)}
        size="icon"
        title="切换主题"
        type="button"
        variant="secondary"
      >
        <ThemeGlyph className="size-4" theme={theme} />
      </Button>

      {open ? (
        <div
          className="absolute top-[calc(100%+0.5rem)] right-0 z-50 flex min-w-44 flex-col gap-0.5 rounded-md border border-border bg-surface p-1.5 shadow-card"
          id={menuId}
          role="menu"
        >
          <p className="px-2.5 pt-1.5 pb-1 text-[0.65rem] font-medium tracking-[0.08em] text-disabled uppercase">
            主题
          </p>
          {THEME_OPTIONS.map((option) => {
            const isActive = option.value === theme;

            return (
              <button
                aria-checked={isActive}
                className={cn(
                  "flex h-[2.125rem] w-full items-center gap-2.5 rounded-sm px-2.5 text-[0.8125rem] text-foreground transition-colors hover:bg-surface-muted",
                  isActive && "text-primary-strong",
                )}
                key={option.value}
                onClick={() => {
                  applyTheme(option.value);
                  setOpen(false);
                }}
                role="menuitemradio"
                type="button"
              >
                <ThemeGlyph className="size-4 shrink-0" theme={option.value} />
                <span>{option.label}</span>
                {isActive ? (
                  <CheckIcon className="ml-auto size-3.5 shrink-0 text-primary" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
