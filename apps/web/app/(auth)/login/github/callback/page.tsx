"use client";

import { Alert, AlertDescription } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Spinner } from "@repo/ui/spinner";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { GitFork } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { readClientSession } from "@/src/auth/client-session";
import {
  consumeStoredGithubOauthState,
  loginWebWithGithubTicket,
} from "@/src/auth/login-client";

function GithubCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const exchangedTicketRef = useRef<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const callbackError = searchParams.get("error");
    const state = searchParams.get("state");
    const ticket = searchParams.get("ticket");

    if (callbackError) {
      consumeStoredGithubOauthState();
      setErrorMessage(callbackError);
      return;
    }

    if (!ticket) {
      consumeStoredGithubOauthState();
      setErrorMessage("GitHub 登录结果缺少 ticket，请重新登录");
      return;
    }

    const loginTicket = ticket;

    if (exchangedTicketRef.current === loginTicket) {
      return;
    }

    const expectedState = consumeStoredGithubOauthState();

    if (!state || !expectedState || state !== expectedState) {
      setErrorMessage("GitHub 登录状态校验失败，请重新登录");
      return;
    }

    exchangedTicketRef.current = loginTicket;

    async function exchangeTicket() {
      try {
        await loginWebWithGithubTicket({ ticket: loginTicket });
        router.replace("/app");
        router.refresh();
      } catch (error) {
        if (readClientSession()) {
          router.replace("/app");
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "GitHub 登录失败，请重新登录",
        );
      }
    }

    void exchangeTicket();
  }, [router, searchParams]);

  return <GithubCallbackStatus errorMessage={errorMessage} />;
}

function GithubCallbackStatus({
  errorMessage,
}: {
  errorMessage: string | null;
}) {
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
          <ThemeToggle className="ml-auto" />
        </header>

        <section className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center py-12 text-center">
          <div className="flex size-11 items-center justify-center rounded-md border border-border bg-surface">
            {errorMessage ? (
              <GitFork aria-hidden="true" className="size-5" />
            ) : (
              <Spinner aria-label="正在处理 GitHub 登录" className="size-5" />
            )}
          </div>
          <h1 className="mt-5 text-xl font-semibold">
            {errorMessage ? "GitHub 登录未完成" : "正在完成 GitHub 登录"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {errorMessage
              ? "授权结果没有创建登录状态。"
              : "正在校验授权结果并创建当前浏览器的登录状态。"}
          </p>

          {errorMessage ? (
            <div className="mt-6 grid w-full gap-4">
              <Alert className="text-left" variant="danger">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
              <Button asChild className="w-full">
                <Link href="/login">返回登录页</Link>
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default function GithubCallbackPage() {
  return (
    <Suspense fallback={<GithubCallbackStatus errorMessage={null} />}>
      <GithubCallbackContent />
    </Suspense>
  );
}
