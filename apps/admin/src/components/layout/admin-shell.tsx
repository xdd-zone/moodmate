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
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { logoutAdmin } from "@/src/auth/api";
import { adminSessionKeys } from "@/src/auth/session.query";

const NAV_ITEMS = [
  { href: "/", label: "首页" },
  { href: "/roles", label: "角色管理" },
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
    <AppShell>
      <Sidebar>
        <SidebarHeader>
          <span className="text-sm font-semibold">moodmate</span>
          <Badge variant="outline">admin</Badge>
        </SidebarHeader>
        <SidebarNav>
          {NAV_ITEMS.map((item) => (
            <SidebarNavItem
              active={
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href)
              }
              asChild
              key={item.href}
            >
              <Link href={item.href}>{item.label}</Link>
            </SidebarNavItem>
          ))}
        </SidebarNav>
        <SidebarFooter>
          <ThemeToggle />
        </SidebarFooter>
      </Sidebar>

      <div className="flex min-h-svh flex-col">
        <AppShellHeader>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Button
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
              size="sm"
              variant="outline"
            >
              {logoutMutation.isPending ? "正在退出" : "退出登录"}
            </Button>
          </div>
        </AppShellHeader>
        <AppShellContent className="flex-1">{children}</AppShellContent>
      </div>
    </AppShell>
  );
}
