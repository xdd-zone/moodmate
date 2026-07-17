"use client";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/alert";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { Separator } from "@repo/ui/separator";
import { useQuery } from "@tanstack/react-query";

import { adminSessionQueryOptions } from "@/src/auth/session.query";
import { HttpRequestError } from "@/src/lib/http";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function AdminDashboard() {
  const sessionQuery = useQuery(adminSessionQueryOptions());

  const session = sessionQuery.data;

  return (
    <section className="mx-auto grid max-w-6xl gap-8 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.7fr)] lg:gap-12">
      <div className="max-w-2xl">
        <Badge className="mb-5" variant="secondary">
          管理工作区
        </Badge>
        <h1 className="text-3xl leading-tight font-semibold text-balance md:text-4xl">
          {session ? `${session.displayName}，欢迎回来` : "正在恢复登录状态"}
        </h1>
        <p className="mt-4 max-w-[52ch] text-sm leading-7 text-muted md:text-base">
          {session
            ? "管理员身份已验证，可以继续处理后台工作。"
            : "正在确认当前浏览器中的管理员凭证。"}
        </p>

        {sessionQuery.isError ? (
          <Alert className="mt-6 max-w-xl" variant="danger">
            <AlertTitle>登录状态恢复失败</AlertTitle>
            <AlertDescription>
              {sessionQuery.error instanceof HttpRequestError
                ? sessionQuery.error.message
                : "无法读取管理员登录状态，请确认服务已启动后重试。"}
            </AlertDescription>
            <Button
              className="mt-3 w-fit"
              onClick={() => sessionQuery.refetch()}
              size="sm"
              variant="secondary"
            >
              重新读取
            </Button>
          </Alert>
        ) : null}
      </div>

      <Card aria-busy={sessionQuery.isPending}>
        <CardHeader>
          <CardTitle>当前账号</CardTitle>
          <CardDescription>当前浏览器恢复出的安全会话信息。</CardDescription>
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
  );
}

function AccountRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid gap-0 first:[&>[data-slot=separator]]:hidden">
      <Separator />
      <div className="grid min-h-12 grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 py-3 text-sm">
        <span className="text-muted">{label}</span>
        <span className="min-w-0 break-words text-right font-medium">
          {value ?? "读取中"}
        </span>
      </div>
    </div>
  );
}
