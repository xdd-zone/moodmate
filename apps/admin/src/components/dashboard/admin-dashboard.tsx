"use client";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { logoutAdmin } from "@/src/auth/api";
import {
  adminSessionKeys,
  adminSessionQueryOptions,
} from "@/src/auth/session.query";
import { HttpRequestError } from "@/src/lib/http";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function AdminDashboard() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const sessionQuery = useQuery(adminSessionQueryOptions());
  const logoutMutation = useMutation({
    mutationFn: logoutAdmin,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: adminSessionKeys.all });
      router.replace("/login");
      router.refresh();
    },
  });

  const session = sessionQuery.data;

  return (
    <main className="min-h-svh px-5 py-6 text-foreground md:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-48px)] max-w-6xl flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-border py-4">
          <span className="text-sm font-semibold">moodmate</span>
          <Badge variant="outline">admin</Badge>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href="/roles">角色管理</Link>
            </Button>
            <ThemeToggle />
            <Button
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
              size="sm"
              variant="outline"
            >
              {logoutMutation.isPending ? "正在退出" : "退出登录"}
            </Button>
          </div>
        </header>

        <section className="grid flex-1 content-center gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.7fr)] lg:gap-12 lg:py-14">
          <div className="max-w-2xl">
            <Badge className="mb-5" variant="secondary">
              管理工作区
            </Badge>
            <h1 className="text-3xl leading-tight font-semibold text-balance md:text-4xl">
              {session
                ? `${session.displayName}，欢迎回来`
                : "正在恢复登录状态"}
            </h1>
            <p className="mt-4 max-w-[52ch] text-sm leading-7 text-muted md:text-base">
              {session
                ? "管理员身份已验证，可以继续处理后台工作。"
                : "正在确认当前浏览器中的管理员凭证。"}
            </p>

            {sessionQuery.isError ? (
              <div className="mt-6 max-w-xl border-l-2 border-danger pl-4">
                <p className="text-sm font-semibold text-danger">
                  登录状态恢复失败
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {sessionQuery.error instanceof HttpRequestError
                    ? sessionQuery.error.message
                    : "无法读取管理员登录状态，请确认服务已启动后重试。"}
                </p>
                <Button
                  className="mt-4"
                  onClick={() => sessionQuery.refetch()}
                  size="sm"
                  variant="secondary"
                >
                  重新读取
                </Button>
              </div>
            ) : null}

            {logoutMutation.isError ? (
              <p className="mt-5 text-sm text-danger" role="alert">
                退出登录失败，请刷新页面后重试。
              </p>
            ) : null}
          </div>

          <Card aria-busy={sessionQuery.isPending}>
            <CardHeader>
              <CardTitle>当前账号</CardTitle>
              <CardDescription>
                当前浏览器恢复出的安全会话信息。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-0">
              <AccountRow label="姓名" value={session?.displayName} />
              <AccountRow label="邮箱" value={session?.email} />
              <AccountRow
                label="权限"
                value={
                  session?.roles.includes("admin_owner") ? "所有者" : undefined
                }
              />
              <AccountRow
                label="会话到期"
                value={
                  session
                    ? dateTimeFormatter.format(new Date(session.expiresAtMs))
                    : undefined
                }
              />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function AccountRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid min-h-12 grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 border-t border-border py-3 text-sm first:border-t-0">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 break-words text-right font-medium">
        {value ?? "读取中"}
      </span>
    </div>
  );
}
