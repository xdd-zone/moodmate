"use client";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Bot,
  MessageSquareWarning,
  ContactRound,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";

import {
  adminProfileKeys,
  adminProfileQueryOptions,
} from "@/src/api/profile.query";
import { logoutAdmin } from "@/src/auth/api";
import {
  adminSessionKeys,
  adminSessionQueryOptions,
} from "@/src/auth/session.query";
import { AdminAvatar } from "@/src/components/profile/admin-avatar";

type NavItem = {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
};

type NavGroup = {
  id: string;
  items: readonly NavItem[];
  label: string;
};

const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "overview",
    items: [{ href: "/overview", icon: LayoutDashboard, label: "数据概览" }],
    label: "概览",
  },
  {
    id: "operations",
    items: [
      { href: "/users", icon: Users, label: "用户管理" },
      { href: "/friends", icon: ContactRound, label: "朋友管理" },
      { href: "/feedback", icon: MessageSquareWarning, label: "消息反馈" },
    ],
    label: "运营",
  },
  {
    id: "ai",
    items: [{ href: "/llm-configs", icon: Bot, label: "模型配置" }],
    label: "AI",
  },
  {
    id: "system",
    items: [
      { href: "/default-avatar", icon: Images, label: "默认头像" },
      { href: "/roles", icon: ShieldCheck, label: "角色权限" },
    ],
    label: "系统",
  },
] as const;

const SIDEBAR_STORAGE_KEY = "admin-sidebar-collapsed";

export function AdminShell({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const profileQuery = useQuery(adminProfileQueryOptions());
  const sessionQuery = useQuery(adminSessionQueryOptions());
  const displayName = sessionQuery.data?.displayName ?? "管理员";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const logoutMutation = useMutation({
    mutationFn: logoutAdmin,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: adminSessionKeys.all });
      queryClient.removeQueries({ queryKey: adminProfileKeys.all });
      router.replace("/login");
      router.refresh();
    },
  });

  useEffect(() => {
    try {
      setSidebarCollapsed(
        window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true",
      );
    } catch {
      // localStorage 不可用时保留展开状态。
    }
  }, []);

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileSidebarOpen(false);
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileSidebarOpen]);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // localStorage 不可用时仍保留当前页面内的折叠状态。
      }

      return next;
    });
  }

  return (
    <div className="admin-canvas">
      <div
        className="admin-frame"
        data-mobile-sidebar-open={mobileSidebarOpen ? "true" : "false"}
        data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
      >
        <a className="admin-skip-link" href="#admin-content">
          跳到主要内容
        </a>

        <aside aria-label="后台导航" className="admin-sidebar">
          <Link
            aria-label="moodmate 管理台首页"
            className="admin-brand"
            href="/overview"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <span aria-hidden="true" className="admin-logo-mark">
              M
            </span>
            <span className="admin-logo-text">moodmate</span>
          </Link>

          <nav aria-label="后台模块" className="admin-sidebar-nav">
            {NAV_GROUPS.map((group) => (
              <div
                aria-labelledby={`admin-nav-group-${group.id}`}
                className="admin-sidebar-nav-group"
                key={group.id}
                role="group"
              >
                <p
                  className="admin-sidebar-nav-group-label"
                  id={`admin-nav-group-${group.id}`}
                >
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isPathActive(pathname, item.href);

                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={`admin-sidebar-nav-item${active ? " admin-sidebar-nav-item-active" : ""}`}
                      href={item.href}
                      key={item.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <Icon aria-hidden="true" className="size-4" />
                      <span className="admin-sidebar-nav-label">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <Button
            aria-label={sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
            className="admin-sidebar-toggle"
            onClick={toggleSidebar}
            size="icon"
            title={sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
            type="button"
            variant="ghost"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-4" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="size-4" />
            )}
          </Button>
        </aside>

        <button
          aria-label="关闭后台导航"
          className="admin-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          tabIndex={mobileSidebarOpen ? 0 : -1}
          type="button"
        />

        <div className="admin-main">
          <header className="admin-bar">
            <Button
              aria-label={mobileSidebarOpen ? "关闭后台导航" : "打开后台导航"}
              className="admin-mobile-menu-button"
              onClick={() => setMobileSidebarOpen((current) => !current)}
              size="icon"
              title={mobileSidebarOpen ? "关闭后台导航" : "打开后台导航"}
              type="button"
              variant="ghost"
            >
              {mobileSidebarOpen ? (
                <X aria-hidden="true" className="size-4" />
              ) : (
                <Menu aria-hidden="true" className="size-4" />
              )}
            </Button>

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
              <ThemeToggle className="admin-theme-toggle" variant="ghost" />
              <Link
                aria-label={`查看${displayName}的管理员资料`}
                className="admin-user-chip"
                href="/profile"
              >
                <AdminAvatar
                  alt=""
                  avatar={profileQuery.data?.avatar ?? null}
                  className="admin-avatar"
                  displayName={displayName}
                />
                <span className="admin-user-name">{displayName}</span>
              </Link>
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

          <main className="admin-content" id="admin-content">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function isPathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
