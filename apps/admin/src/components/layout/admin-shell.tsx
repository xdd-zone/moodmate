"use client";

import {
  AppShell,
  AppShellContent,
  AppShellHeader,
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarNav,
  SidebarNavItem,
} from "@repo/ui/app-shell";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BookOpenText,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  Smile,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType, ReactNode } from "react";

import { logoutAdmin } from "@/src/auth/api";
import { adminSessionKeys } from "@/src/auth/session.query";

type NavItem = {
  count?: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
};

const NAV_GROUPS: ReadonlyArray<{ label: string; items: readonly NavItem[] }> =
  [
    {
      label: "概览",
      items: [{ href: "/", icon: LayoutDashboard, label: "数据概览" }],
    },
    {
      label: "运营",
      items: [
        { count: "2.4k", href: "/moods", icon: Smile, label: "情绪记录" },
        { count: "861", icon: Users, label: "用户管理" },
        { icon: BookOpenText, label: "内容管理" },
      ],
    },
    {
      label: "系统",
      items: [
        { href: "/roles", icon: ShieldCheck, label: "角色管理" },
        { icon: Settings, label: "系统设置" },
      ],
    },
  ] as const;

const MOBILE_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items).filter(
  (item): item is NavItem & { href: string } => Boolean(item.href),
);

const PAGE_META = {
  "/": { group: "概览", page: "数据概览" },
  "/moods": { group: "运营", page: "情绪记录" },
  "/roles": { group: "系统", page: "角色管理" },
} as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const pageMeta = getPageMeta(pathname);
  const logoutMutation = useMutation({
    mutationFn: logoutAdmin,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: adminSessionKeys.all });
      router.replace("/login");
      router.refresh();
    },
  });

  const logoutButton = (
    <Button
      aria-label={logoutMutation.isPending ? "正在退出" : "退出登录"}
      className="size-11 min-h-11 p-0 lg:size-9 lg:min-h-9"
      disabled={logoutMutation.isPending}
      onClick={() => logoutMutation.mutate()}
      size="icon"
      title={logoutMutation.isPending ? "正在退出" : "退出登录"}
      variant="ghost"
    >
      <LogOut className="size-4" />
    </Button>
  );

  return (
    <AppShell className="[--sidebar-w:14.5rem] md:grid-cols-1 lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]">
      <a
        className="fixed top-2 left-2 z-[70] -translate-y-20 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-transform focus:translate-y-0"
        href="#admin-content"
      >
        跳到主要内容
      </a>

      <Sidebar className="hidden gap-1 bg-surface-muted px-3 py-4 lg:flex">
        <SidebarHeader className="px-2 pb-3">
          <div className="grid size-7 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            M
          </div>
          <span className="text-sm font-semibold">moodmate</span>
          <Badge
            className="min-h-5 px-1.5 py-0 text-[0.65rem]"
            variant="outline"
          >
            admin
          </Badge>
        </SidebarHeader>

        {NAV_GROUPS.map((group) => (
          <div className="mt-1" key={group.label}>
            <p className="px-2 pt-3 pb-1.5 text-[0.6875rem] font-semibold text-disabled uppercase">
              {group.label}
            </p>
            <SidebarNav>
              {group.items.map((item) => (
                <DesktopNavItem
                  item={item}
                  key={item.label}
                  pathname={pathname}
                />
              ))}
            </SidebarNav>
          </div>
        ))}

        <SidebarFooter className="border-t border-border pt-3">
          <ThemeToggle className="w-full" />
        </SidebarFooter>
      </Sidebar>

      <div className="flex min-h-svh min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background lg:hidden">
          <div className="flex min-h-14 items-center gap-2 px-4">
            <div className="grid size-7 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              M
            </div>
            <span className="text-sm font-semibold">moodmate</span>
            <Badge
              className="min-h-5 px-1.5 py-0 text-[0.65rem]"
              variant="outline"
            >
              admin
            </Badge>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              {logoutButton}
            </div>
          </div>
          <nav
            aria-label="后台导航"
            className="flex gap-1 overflow-x-auto px-3 pb-2"
          >
            {MOBILE_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isPathActive(pathname, item.href);

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "flex min-h-11 shrink-0 items-center gap-2 rounded-md bg-primary-subtle px-3 text-sm font-semibold text-primary-strong outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      : "flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-muted outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-focus"
                  }
                  href={item.href}
                  key={item.href}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <AppShellHeader className="sticky top-0 z-20 hidden h-[3.75rem] flex-nowrap bg-background/90 px-6 py-0 backdrop-blur-sm lg:flex">
          <nav aria-label="面包屑" className="flex items-center gap-2 text-xs">
            <span className="text-muted">{pageMeta.group}</span>
            <span className="text-disabled">/</span>
            <span className="font-semibold text-foreground">
              {pageMeta.page}
            </span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <label className="relative hidden xl:block">
              <span className="sr-only">搜索后台内容</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <Input
                className="h-9 min-h-9 w-64 bg-surface pr-12 pl-9 text-xs"
                placeholder="搜索记录、用户、标签"
              />
              <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-sm border border-border bg-background px-1.5 py-0.5 text-[0.625rem] text-disabled">
                ⌘K
              </kbd>
            </label>
            <Button
              aria-label="通知"
              className="relative size-9 min-h-9 p-0"
              size="icon"
              title="通知"
              variant="secondary"
            >
              <Bell className="size-4" />
              <span className="absolute top-2 right-2 size-1.5 rounded-full bg-danger" />
            </Button>
            <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-1.5 pr-3">
              <span className="grid size-7 place-items-center rounded-full bg-[var(--theme-mauve)] text-xs font-semibold text-[var(--theme-base)]">
                喜
              </span>
              <span className="text-xs font-semibold">运营喜东东</span>
            </div>
            {logoutButton}
          </div>
        </AppShellHeader>

        <AppShellContent
          className="flex-1 px-4 py-5 sm:px-5 lg:px-6 lg:py-6"
          id="admin-content"
        >
          {children}
        </AppShellContent>
      </div>
    </AppShell>
  );
}

function DesktopNavItem({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const Icon = item.icon;

  if (!item.href) {
    return (
      <div
        aria-disabled="true"
        className="flex min-h-10 items-center gap-2.5 rounded-md px-2.5 text-[0.8125rem] text-muted opacity-65"
      >
        <Icon className="size-4" />
        <span>{item.label}</span>
        {item.count ? (
          <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-[0.6875rem] text-disabled">
            {item.count}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <SidebarNavItem
      active={isPathActive(pathname, item.href)}
      asChild
      className="min-h-10 gap-2.5 px-2.5 text-[0.8125rem]"
    >
      <Link href={item.href}>
        <Icon className="size-4" />
        <span>{item.label}</span>
        {item.count ? (
          <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-[0.6875rem] text-disabled">
            {item.count}
          </span>
        ) : null}
      </Link>
    </SidebarNavItem>
  );
}

function getPageMeta(pathname: string) {
  if (pathname.startsWith("/moods")) return PAGE_META["/moods"];
  if (pathname.startsWith("/roles")) return PAGE_META["/roles"];
  return PAGE_META["/"];
}

function isPathActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}
