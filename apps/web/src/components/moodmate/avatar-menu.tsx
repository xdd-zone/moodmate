"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

import { MoodmateAvatar } from "./avatar";
import { classNames } from "./class-names";
import type { MoodmateProfile } from "./models";

export type MoodmateAvatarMenuItem = {
  danger?: boolean;
  disabled?: boolean;
  href?: string;
  icon: LucideIcon;
  label: string;
  onSelect?: () => void;
  separatorBefore?: boolean;
};

type MoodmateAvatarMenuProps = {
  items: MoodmateAvatarMenuItem[];
  label: string;
  profile: MoodmateProfile;
};

type MenuPosition = {
  left: number;
  top: number;
};

const viewportGap = 8;

export function MoodmateAvatarMenu({
  items,
  label,
  profile,
}: MoodmateAvatarMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const isOpen = position !== null;

  useLayoutEffect(() => {
    const menu = menuRef.current;

    if (!isOpen || !menu) return;

    const bounds = menu.getBoundingClientRect();
    const left = Math.min(
      Math.max(position.left, viewportGap),
      window.innerWidth - bounds.width - viewportGap,
    );
    const top = Math.min(
      Math.max(position.top, viewportGap),
      window.innerHeight - bounds.height - viewportGap,
    );

    if (left !== position.left || top !== position.top) {
      setPosition({ left, top });
    }
  }, [isOpen, position]);

  useEffect(() => {
    if (!isOpen) return;

    function closeMenu() {
      setPosition(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
        triggerRef.current?.focus();
      }
    }

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function openAt(left: number, top: number) {
    setPosition({ left, top });
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    if (isOpen) {
      setPosition(null);
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    openAt(bounds.right + viewportGap, bounds.bottom - 8);
  }

  function handleContextMenu(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    openAt(event.clientX, event.clientY);
  }

  function handleSelect(item: MoodmateAvatarMenuItem) {
    if (item.disabled) return;
    setPosition(null);
    item.onSelect?.();
  }

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={label}
        className="moodmate-avatar-menu__trigger"
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        ref={triggerRef}
        type="button"
      >
        <MoodmateAvatar profile={profile} size="sm" />
      </button>
      <div
        aria-label={label}
        className={classNames(
          "moodmate-context-menu",
          isOpen && "moodmate-context-menu--open",
        )}
        onPointerDown={(event) => event.stopPropagation()}
        ref={menuRef}
        role="menu"
        style={position ?? undefined}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
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
              {item.href ? (
                <Link
                  aria-disabled={item.disabled}
                  className={itemClassName}
                  href={item.href}
                  onClick={() => handleSelect(item)}
                  role="menuitem"
                  tabIndex={item.disabled ? -1 : 0}
                >
                  {content}
                </Link>
              ) : (
                <button
                  className={itemClassName}
                  disabled={item.disabled}
                  onClick={() => handleSelect(item)}
                  role="menuitem"
                  type="button"
                >
                  {content}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
