"use client";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { ThemeMenu } from "@repo/ui/theme-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  LayoutDashboard,
  LogOut,
  Images,
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
  soon?: boolean;
};

const NAV_ITEMS: readonly NavItem[] = [
  { icon: LayoutDashboard, label: "数据概览", soon: true },
  { count: "2.4k", href: "/moods", icon: Smile, label: "情绪记录" },
  { href: "/users", icon: Users, label: "用户管理" },
  { href: "/roles", icon: ShieldCheck, label: "角色权限" },
  { href: "/default-avatar", icon: Images, label: "默认头像" },
  { href: "/settings", icon: Settings, label: "系统设置" },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const logoutMutation = useMutation({
    mutationFn: logoutAdmin,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: adminSessionKeys.all });
      router.replace("/login");
      router.refresh();
    },
  });

  return (
    <div className="admin-canvas">
      <div className="admin-frame">
        <a className="admin-skip-link" href="#admin-content">
          跳到主要内容
        </a>

        <header className="admin-bar">
          <Link
            aria-label="moodmate 管理台首页"
            className="admin-brand"
            href="/moods"
          >
            <span aria-hidden="true" className="admin-logo-mark">
              M
            </span>
            <span className="admin-logo-text">moodmate</span>
            <Badge className="admin-brand-badge" variant="outline">
              admin
            </Badge>
          </Link>

          <div className="admin-actions">
            <label className="admin-search">
              <span className="sr-only">搜索后台内容</span>
              <Search aria-hidden="true" className="size-4" />
              <Input
                aria-label="搜索记录、用户、标签"
                className="admin-search-input"
                placeholder="搜索记录、用户、标签"
              />
              <kbd>⌘K</kbd>
            </label>
            <Button
              aria-label="通知"
              className="admin-icon-button"
              size="icon"
              title="通知"
              variant="ghost"
            >
              <Bell aria-hidden="true" className="size-4" />
              <span aria-hidden="true" className="admin-notice-dot" />
            </Button>
            <ThemeMenu className="admin-theme-menu" />
            <div className="admin-user-chip">
              <span aria-hidden="true" className="admin-avatar">
                喜
              </span>
              <span className="admin-user-name">运营喜东东</span>
            </div>
            <Button
              aria-label={logoutMutation.isPending ? "正在退出" : "退出登录"}
              className="admin-icon-button"
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
              size="icon"
              title={logoutMutation.isPending ? "正在退出" : "退出登录"}
              variant="ghost"
            >
              <LogOut aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </header>

        <nav aria-label="后台模块" className="admin-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.href
              ? isPathActive(pathname, item.href)
              : false;

            if (!item.href) {
              return (
                <span
                  aria-disabled="true"
                  className="admin-nav-tab admin-nav-tab-soon"
                  key={item.label}
                  title="数据概览模块建设中"
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {item.label}
                  <span className="admin-nav-soon-tag">待建</span>
                </span>
              );
            }

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`admin-nav-tab${active ? " admin-nav-tab-active" : ""}`}
                href={item.href}
                key={item.href}
              >
                <Icon aria-hidden="true" className="size-4" />
                {item.label}
                {item.count ? (
                  <span className="admin-nav-count">{item.count}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <main className="admin-content" id="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}

function isPathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
