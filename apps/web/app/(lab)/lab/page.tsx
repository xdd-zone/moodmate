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
import Link from "next/link";
import { useState } from "react";

import {
  healthQueryOptions,
  pingMutationOptions,
} from "@/src/api/system.query";
import { HttpRequestError } from "@/src/lib/http";

const statusSamples = [
  {
    className: "bg-primary-subtle text-primary-strong",
    label: "Primary",
  },
  { className: "bg-success-subtle text-success", label: "Success" },
  { className: "bg-warning-subtle text-warning", label: "Warning" },
  { className: "bg-info-subtle text-info", label: "Info" },
  { className: "bg-danger-subtle text-danger", label: "Danger" },
] as const;

function getErrorMessage(error: Error | null) {
  if (error instanceof HttpRequestError) {
    return `${error.message}${error.status ? `（HTTP ${error.status}）` : ""}`;
  }

  return error?.message ?? "请求失败，请检查 API 服务是否已启动。";
}

export default function LabPage() {
  const queryClient = useQueryClient();
  const healthQuery = useQuery(healthQueryOptions());
  const pingMutation = useMutation(pingMutationOptions(queryClient));
  const [name, setName] = useState("moodmate web");

  function handlePing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    pingMutation.mutate({ name: trimmedName });
  }

  return (
    <main className="min-h-svh px-[clamp(20px,5vw,64px)] py-7 text-foreground md:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-6 border-b border-border pb-7 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl space-y-3 animate-rise-soft">
            <Badge variant="outline">Web Lab</Badge>
            <div className="space-y-2">
              <h1 className="text-3xl leading-tight font-semibold text-balance md:text-5xl">
                样式与 Provider 验证
              </h1>
              <p className="max-w-[66ch] text-sm leading-6 text-muted md:text-base md:leading-7">
                这个路由用于检查共享组件、Latte 与 Mocha 主题，以及 TanStack
                Query 发起的健康检查和 Ping 请求。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="ghost">
              <Link href="/">返回首页</Link>
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
          <Card className="animate-rise-soft [animation-delay:80ms]">
            <CardHeader>
              <CardDescription>语义表面</CardDescription>
              <CardTitle>共享 token 与组件</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-background p-4">
                <p className="text-sm font-semibold">background</p>
                <p className="mt-2 text-xs leading-5 text-muted">页面底色</p>
              </div>
              <div className="rounded-md border border-border bg-surface p-4">
                <p className="text-sm font-semibold">surface</p>
                <p className="mt-2 text-xs leading-5 text-muted">主要内容层</p>
              </div>
              <div className="rounded-md border border-border bg-surface-muted p-4">
                <p className="text-sm font-semibold">surface-muted</p>
                <p className="mt-2 text-xs leading-5 text-muted">辅助内容层</p>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-rise-soft [animation-delay:140ms]">
            <CardHeader>
              <CardDescription>状态色</CardDescription>
              <CardTitle>主题语义映射</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {statusSamples.map((sample) => (
                <span
                  className={`rounded-sm px-2.5 py-1 text-xs font-semibold ${sample.className}`}
                  key={sample.label}
                >
                  {sample.label}
                </span>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader className="border-b border-border">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardDescription>Query Provider / GET</CardDescription>
                  <CardTitle className="mt-1">服务健康检查</CardTitle>
                </div>
                <Badge
                  variant={healthQuery.isSuccess ? "default" : "secondary"}
                >
                  {healthQuery.isPending
                    ? "请求中"
                    : healthQuery.isError
                      ? "失败"
                      : "正常"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              {healthQuery.isSuccess ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
                  <dt className="text-muted">service</dt>
                  <dd>{healthQuery.data.service}</dd>
                  <dt className="text-muted">status</dt>
                  <dd>{healthQuery.data.status}</dd>
                  <dt className="text-muted">env</dt>
                  <dd>{healthQuery.data.env}</dd>
                </dl>
              ) : healthQuery.isError ? (
                <p className="rounded-md bg-danger-subtle p-3 text-sm leading-6 text-danger">
                  {getErrorMessage(healthQuery.error)}
                </p>
              ) : (
                <p className="text-sm text-muted">正在请求 `/health`。</p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={healthQuery.isFetching}
                  onClick={() => void healthQuery.refetch()}
                  variant="secondary"
                >
                  {healthQuery.isFetching ? "刷新中" : "刷新健康状态"}
                </Button>
                <span className="text-xs text-muted">
                  QueryClient 已挂载，缓存 key 为 system / health
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border">
              <CardDescription>Mutation / POST</CardDescription>
              <CardTitle>Ping 请求</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <form className="space-y-5" onSubmit={handlePing}>
                <label
                  className="grid gap-2 text-sm font-medium"
                  htmlFor="ping-name"
                >
                  请求名称
                  <input
                    className="min-h-11 rounded-md border border-border bg-background px-3 text-foreground outline-none transition-colors placeholder:text-disabled focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-focus"
                    id="ping-name"
                    onChange={(event) => setName(event.target.value)}
                    placeholder="输入非空名称"
                    value={name}
                  />
                </label>

                {pingMutation.isSuccess ? (
                  <div className="rounded-md bg-success-subtle p-3 text-sm leading-6 text-success">
                    {pingMutation.data.message} · {pingMutation.data.env}
                  </div>
                ) : pingMutation.isError ? (
                  <p className="rounded-md bg-danger-subtle p-3 text-sm leading-6 text-danger">
                    {getErrorMessage(pingMutation.error)}
                  </p>
                ) : (
                  <p className="text-sm leading-6 text-muted">
                    提交后调用 `/rpc/system/ping`，成功时使健康检查缓存失效。
                  </p>
                )}

                <Button
                  disabled={pingMutation.isPending || !name.trim()}
                  type="submit"
                >
                  {pingMutation.isPending ? "发送中" : "发送 Ping"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-col gap-4 border-t border-border pt-7 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">按钮样式</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              用现有组件检查主要、次要、描边和危险操作状态。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button>主要按钮</Button>
            <Button variant="secondary">次要按钮</Button>
            <Button variant="outline">描边按钮</Button>
            <Button variant="danger">危险按钮</Button>
          </div>
        </section>
      </div>
    </main>
  );
}
