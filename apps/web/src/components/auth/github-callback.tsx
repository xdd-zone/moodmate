"use client";

import { Button } from "@repo/ui/button";
import { Spinner } from "@repo/ui/spinner";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FaGithub } from "react-icons/fa6";

import { readClientSession } from "@/src/auth/client-session";
import {
  consumeStoredGithubOauthState,
  loginWebWithGithubTicket,
} from "@/src/auth/login-client";

export function GithubCallback() {
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
      setErrorMessage("GitHub 登录结果缺少 ticket，请返回首页重试");
      return;
    }

    const loginTicket = ticket;

    if (exchangedTicketRef.current === loginTicket) {
      return;
    }

    const expectedState = consumeStoredGithubOauthState();

    if (!state || !expectedState || state !== expectedState) {
      setErrorMessage("GitHub 登录状态校验失败，请返回首页重试");
      return;
    }

    exchangedTicketRef.current = loginTicket;

    async function exchangeTicket() {
      try {
        await loginWebWithGithubTicket({ ticket: loginTicket });
        router.replace("/chats");
        router.refresh();
      } catch (error) {
        if (readClientSession()) {
          router.replace("/chats");
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "GitHub 登录失败，请返回首页重试",
        );
      }
    }

    void exchangeTicket();
  }, [router, searchParams]);

  return <GithubCallbackStatus errorMessage={errorMessage} />;
}

export function GithubCallbackStatus({
  errorMessage,
}: {
  errorMessage: string | null;
}) {
  return (
    <main className="moodmate moodmate-auth">
      <header className="moodmate-auth__topnav">
        <div className="moodmate-auth__container moodmate-auth__topnav-inner">
          <Link
            aria-label="返回 MoodMate 首页"
            className="moodmate-auth__brand"
            href="/"
          >
            <span aria-hidden="true" className="moodmate-auth__brand-mark">
              M
            </span>
            <span>MoodMate</span>
          </Link>
          <ThemeToggle
            className="moodmate-auth__theme-toggle"
            variant="ghost"
          />
        </div>
      </header>

      <section className="moodmate-auth__stage moodmate-auth__stage--status">
        <div className="moodmate-auth__container moodmate-auth__status-wrap">
          <section
            aria-labelledby="github-callback-title"
            aria-live="polite"
            className="moodmate-auth__status-panel"
          >
            <span aria-hidden="true" className="moodmate-auth__status-icon">
              {errorMessage ? <FaGithub /> : <Spinner />}
            </span>
            <p className="moodmate-auth__panel-kicker">GitHub 登录</p>
            <h1 id="github-callback-title">
              {errorMessage ? "GitHub 登录未完成。" : "正在完成登录。"}
            </h1>
            <p>
              {errorMessage
                ? errorMessage
                : "正在校验授权结果并创建当前浏览器的登录状态。"}
            </p>
            {errorMessage ? (
              <Button
                asChild
                className="moodmate-auth__primary-button"
                size="lg"
              >
                <Link href="/">
                  <ArrowLeft aria-hidden="true" />
                  返回首页重试
                </Link>
              </Button>
            ) : null}
            <span className="moodmate-auth__secure-note">
              <LockKeyhole aria-hidden="true" />
              {errorMessage ? "未创建登录状态" : "安全登录"}
            </span>
          </section>
        </div>
      </section>
    </main>
  );
}
