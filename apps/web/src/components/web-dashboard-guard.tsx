"use client";

import type { WebSession, WebUserProfile } from "@repo/contracts";
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getWebUserProfile } from "@/src/api/user.api";
import {
  clearClientSession,
  readClientSession,
} from "@/src/auth/client-session";

interface DashboardState {
  profile: WebUserProfile;
  session: WebSession;
}

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export function WebDashboardGuard() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardState | null>(null);

  useEffect(() => {
    const storedSession = readClientSession();

    if (!storedSession) {
      router.replace("/login");
      return;
    }

    const abortController = new AbortController();

    async function loadProfile() {
      try {
        const profile = await getWebUserProfile({
          init: { signal: abortController.signal },
        });
        const latestSession = readClientSession();

        if (!latestSession) {
          router.replace("/login");
          return;
        }

        setDashboard({ profile, session: latestSession.session });
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        clearClientSession();
        router.replace("/login");
      }
    }

    void loadProfile();
    return () => abortController.abort();
  }, [router]);

  if (!dashboard) {
    return (
      <main
        aria-busy="true"
        className="grid min-h-svh place-items-center px-5 text-foreground"
      >
        <p className="text-sm text-muted" role="status">
          正在恢复登录状态
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-svh px-[clamp(20px,6vw,80px)] py-6 text-foreground">
      <div className="mx-auto flex min-h-[calc(100svh-48px)] max-w-6xl flex-col">
        <header className="flex min-h-14 items-center gap-4 border-b border-border/70 py-3">
          <Link
            className="rounded-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
            href="/"
          >
            moodmate
          </Link>
          <Badge className="hidden sm:inline-flex" variant="outline">
            登录状态有效
          </Badge>
          <ThemeToggle className="ml-auto" />
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:gap-[clamp(48px,9vw,112px)] lg:py-16">
          <section className="max-w-2xl animate-rise-soft">
            <p className="mb-4 text-sm font-medium text-primary-strong">
              今天的记录
            </p>
            <h1 className="text-[clamp(2.5rem,6vw,4.75rem)] leading-[1.04] font-semibold text-balance">
              {dashboard.profile.displayName}，欢迎回来。
            </h1>
            <p className="mt-6 max-w-[56ch] text-base leading-7 text-muted md:text-lg md:leading-8">
              你的账号已经准备好。当前还没有情绪记录。
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="w-full sm:w-auto">
                <Link href="/">返回首页</Link>
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  clearClientSession();
                  router.replace("/login");
                }}
                variant="secondary"
              >
                清除本机登录
              </Button>
            </div>
          </section>

          <Card className="animate-rise-soft overflow-hidden [animation-delay:100ms]">
            <CardHeader className="border-b border-border">
              <CardDescription>当前账号</CardDescription>
              <CardTitle className="break-words text-xl">
                {dashboard.profile.email}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 pt-5">
              <div>
                <p className="text-xs text-muted">身份</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {dashboard.profile.roles.map((role) => (
                    <Badge key={role} variant="secondary">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted">会话有效期</p>
                <p className="mt-2 text-sm leading-6">
                  {dateTimeFormatter.format(
                    new Date(dashboard.session.expiresAtMs),
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
