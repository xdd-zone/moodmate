"use client";

import { AdminPasswordLoginRequestSchema } from "@repo/contracts";
import { Button } from "@repo/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import { adminSessionKeys } from "@/src/auth/session.query";
import { loginAdmin } from "@/src/auth/api";
import { HttpRequestError } from "@/src/lib/http";

const inputClassName =
  "min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60";

export function LoginForm() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const result = AdminPasswordLoginRequestSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!result.success) {
      setErrorMessage(result.error.issues[0]?.message ?? "请检查登录信息");
      return;
    }

    startTransition(async () => {
      try {
        const session = await loginAdmin(result.data);
        queryClient.setQueryData(adminSessionKeys.current(), session);
        router.replace("/");
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof HttpRequestError
            ? error.message
            : "登录请求失败，请确认服务已启动后重试",
        );
      }
    });
  }

  return (
    <main className="min-h-svh px-5 py-6 text-foreground md:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-48px)] max-w-6xl flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-border py-4">
          <span className="text-sm font-semibold">moodmate</span>
          <span className="rounded-sm border border-border px-2 py-0.5 text-xs font-medium text-muted">
            admin
          </span>
          <ThemeToggle className="ml-auto" />
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:py-14">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-primary-strong">
              管理员登录
            </p>
            <h1 className="mt-3 text-3xl leading-tight font-semibold text-balance md:text-4xl">
              进入 moodmate 管理台
            </h1>
            <p className="mt-4 max-w-[48ch] text-sm leading-7 text-muted md:text-base">
              使用管理员账号继续。登录状态由当前浏览器安全保存。
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>账号登录</CardTitle>
              <CardDescription>输入管理员邮箱和密码。</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-5" onSubmit={handleSubmit}>
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="email">
                    邮箱
                  </label>
                  <input
                    autoComplete="username"
                    autoFocus
                    className={inputClassName}
                    disabled={isPending}
                    id="email"
                    name="email"
                    placeholder="admin@example.com"
                    required
                    type="email"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="password">
                    密码
                  </label>
                  <input
                    autoComplete="current-password"
                    className={inputClassName}
                    disabled={isPending}
                    id="password"
                    name="password"
                    required
                    type="password"
                  />
                </div>

                {errorMessage ? (
                  <p
                    className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm leading-6 text-danger"
                    role="alert"
                  >
                    {errorMessage}
                  </p>
                ) : null}

                <Button className="w-full" disabled={isPending} type="submit">
                  {isPending ? "正在登录" : "登录管理台"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
