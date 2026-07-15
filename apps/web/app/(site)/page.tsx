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

import { getWebClientEnv } from "../../src/env/client";
import { getWebServerEnv } from "../../src/env/server";

const moodOptions = [
  { label: "平静", color: "bg-primary" },
  { label: "有点累", color: "bg-warm" },
  { label: "紧张", color: "bg-rose" },
];

const steps = ["写下情绪", "记下原因", "选一个下一步行动"];

export default function Home() {
  getWebServerEnv();
  const env = getWebClientEnv();
  const serviceStatusHref = `${env.NEXT_PUBLIC_API_BASE_URL}/health`;

  return (
    <main className="min-h-svh px-[clamp(20px,6vw,80px)] py-6 text-foreground">
      <div className="mx-auto flex min-h-[calc(100svh-48px)] max-w-7xl flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-border/70 py-4 text-sm">
          <Link
            className="rounded-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
            href="/"
          >
            moodmate
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-3 text-muted">
            <ThemeToggle />
            <a
              className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
              href={serviceStatusHref}
            >
              服务状态
            </a>
            <Link
              className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
              href="/app"
            >
              进入应用
            </Link>
          </nav>
        </header>

        <section className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.72fr)] lg:py-20">
          <div className="max-w-3xl animate-rise-soft">
            <Badge className="mb-5 shadow-soft" variant="outline">
              情绪记录工具
            </Badge>
            <h1 className="text-5xl leading-none font-semibold text-balance md:text-7xl lg:text-8xl">
              先把今天
              <span className="block text-primary">放轻一点。</span>
            </h1>
            <p className="mt-7 max-w-[56ch] text-base leading-7 text-muted md:text-lg md:leading-8">
              moodmate
              用来记录情绪、原因和下一步行动。先写清楚发生了什么，再决定今天要做哪一件小事。
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="w-full sm:w-auto">
                <Link href="/app">开始记录</Link>
              </Button>
              <Button asChild className="w-full sm:w-auto" variant="secondary">
                <a href={serviceStatusHref}>查看服务状态</a>
              </Button>
            </div>
          </div>

          <Card className="animate-rise-soft overflow-hidden [animation-delay:120ms]">
            <CardHeader className="border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardDescription>今日记录</CardDescription>
                  <CardTitle className="mt-1 text-2xl leading-8">
                    先选一个接近的状态
                  </CardTitle>
                </div>
                <Badge variant="secondary">草稿</Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-5">
              <section>
                <p className="mb-3 text-sm text-muted">情绪</p>
                <div className="flex flex-wrap gap-2">
                  {moodOptions.map((option) => (
                    <span
                      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      key={option.label}
                    >
                      <i
                        aria-hidden="true"
                        className={`size-2 rounded-sm ${option.color}`}
                      />
                      {option.label}
                    </span>
                  ))}
                </div>
              </section>

              <section>
                <p className="mb-3 text-sm text-muted">原因</p>
                <div className="rounded-md border border-border bg-background p-4 text-sm leading-6 text-foreground">
                  今天事情不多，但脑子一直停不下来。先把待办拆小，不急着一次做完。
                </div>
              </section>

              <section>
                <p className="mb-3 text-sm text-muted">下一步行动</p>
                <div className="grid gap-2">
                  {steps.map((step, index) => (
                    <div
                      className="flex min-h-10 items-center gap-3 rounded-md bg-surface-muted px-3 py-2 text-sm"
                      key={step}
                    >
                      <span className="grid size-6 shrink-0 place-items-center rounded-sm bg-surface text-xs text-muted">
                        {index + 1}
                      </span>
                      {step}
                    </div>
                  ))}
                </div>
              </section>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
