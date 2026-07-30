"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { classNames } from "./class-names";

export type MoodmateConversationMenuItem = {
  checked?: boolean;
  danger?: boolean;
  disabled?: boolean;
  href?: string;
  icon: LucideIcon;
  label: string;
  onSelect?: () => void;
  separatorBefore?: boolean;
  stateLabel?: string;
  title?: string;
};

export type MoodmateMenuAnchor = {
  left: number;
  top: number;
};

type MoodmateConversationMenuProps = {
  anchor: MoodmateMenuAnchor | null;
  items: MoodmateConversationMenuItem[];
  label: string;
  onClose: () => void;
};

type MenuPosition = {
  left: number;
  top: number;
};

const viewportGap = 12;
const itemSelector = "[data-menu-item]:not([disabled])";

export function MoodmateConversationMenu({
  anchor,
  items,
  label,
  onClose,
}: MoodmateConversationMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;

    if (!anchor || !menu) {
      setPosition(null);
      return;
    }

    // offsetWidth / offsetHeight 不受菜单入场 transform 影响，量出的是最终尺寸
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    setPosition({
      left: Math.max(
        viewportGap,
        Math.min(anchor.left, window.innerWidth - width - viewportGap),
      ),
      top: Math.max(
        viewportGap,
        Math.min(anchor.top, window.innerHeight - height - viewportGap),
      ),
    });
  }, [anchor]);

  useEffect(() => {
    if (!position) return;

    menuRef.current?.querySelector<HTMLElement>(itemSelector)?.focus();
  }, [position]);

  useEffect(() => {
    if (!anchor) return;

    function dismiss() {
      onClose();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchor, onClose]);

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const menu = menuRef.current;

    if (!menu) return;

    const focusable = Array.from(
      menu.querySelectorAll<HTMLElement>(itemSelector),
    );

    if (focusable.length === 0) return;

    const currentIndex = focusable.indexOf(
      document.activeElement as HTMLElement,
    );

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        (currentIndex + offset + focusable.length) % focusable.length;
      focusable[nextIndex]?.focus();
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusable[0]?.focus();
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusable[focusable.length - 1]?.focus();
    }
  }

  function handleSelect(item: MoodmateConversationMenuItem) {
    if (item.disabled) return;

    onClose();
    item.onSelect?.();
  }

  const isOpen = anchor !== null;

  return (
    <div
      aria-hidden={!isOpen}
      aria-label={label}
      className={classNames(
        "moodmate-context-menu",
        "moodmate-context-menu--conversation",
        position && "moodmate-context-menu--open",
      )}
      hidden={!isOpen}
      onKeyDown={handleMenuKeyDown}
      onPointerDown={(event) => event.stopPropagation()}
      ref={menuRef}
      role="menu"
      style={position ?? undefined}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isToggle = item.checked !== undefined;
        const content = (
          <>
            <Icon aria-hidden="true" />
            <span className="moodmate-context-menu__label">{item.label}</span>
            {item.stateLabel ? (
              <span aria-hidden="true" className="moodmate-context-menu__state">
                {item.stateLabel}
              </span>
            ) : null}
          </>
        );
        const itemClassName = classNames(
          "moodmate-context-menu__item",
          item.danger && "moodmate-context-menu__item--danger",
        );

        return (
          <div key={item.label}>
            {item.separatorBefore ? (
              <div className="moodmate-context-menu__separator" />
            ) : null}
            {item.href && !item.disabled ? (
              <Link
                className={itemClassName}
                data-menu-item=""
                href={item.href}
                onClick={() => handleSelect(item)}
                role="menuitem"
                title={item.title}
              >
                {content}
              </Link>
            ) : (
              <button
                aria-checked={isToggle ? item.checked : undefined}
                className={itemClassName}
                data-menu-item=""
                disabled={item.disabled}
                onClick={() => handleSelect(item)}
                role={isToggle ? "menuitemcheckbox" : "menuitem"}
                title={item.title}
                type="button"
              >
                {content}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
