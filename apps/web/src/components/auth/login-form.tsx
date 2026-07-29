"use client";

import { WebPasswordLoginRequestSchema } from "@repo/contracts";
import { Alert, AlertDescription } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Field, FieldError, FieldLabel } from "@repo/ui/field";
import { Input } from "@repo/ui/input";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { ArrowLeft, ArrowRight, ChevronRight, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { FaGithub, FaGoogle } from "react-icons/fa6";

import { readClientSession } from "@/src/auth/client-session";
import { loginWeb } from "@/src/auth/login-client";
import { HttpRequestError } from "@/src/lib/http";

type FieldErrors = {
  email?: string;
  password?: string;
};

type LoginStage = "login" | "welcome";

export function LoginForm() {
  const router = useRouter();
  const enterButtonRef = useRef<HTMLButtonElement>(null);
  const firstLoginControlRef = useRef<HTMLButtonElement>(null);
  const hasOpenedLoginRef = useRef(false);
  const [stage, setStage] = useState<LoginStage>("welcome");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isPasswordPending, startPasswordTransition] = useTransition();

  useEffect(() => {
    if (readClientSession()) {
      router.replace("/chats");
    }
  }, [router]);

  useEffect(() => {
    if (stage === "login") {
      hasOpenedLoginRef.current = true;
      firstLoginControlRef.current?.focus();
      return;
    }

    if (hasOpenedLoginRef.current) {
      enterButtonRef.current?.focus();
    }
  }, [stage]);

  useEffect(() => {
    if (stage !== "login") return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPasswordPending) {
        setStage("welcome");
        setOauthMessage(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPasswordPending, stage]);

  function showLogin() {
    setStage("login");
  }

  function showWelcome() {
    if (isPasswordPending) return;
    setStage("welcome");
    setErrorMessage(null);
    setOauthMessage(null);
    setFieldErrors({});
  }

  function showOauthUnavailable(provider: "GitHub" | "Google") {
    setErrorMessage(null);
    setOauthMessage(`${provider} 登录暂未开放，请使用邮箱密码登录。`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setOauthMessage(null);

    const formData = new FormData(event.currentTarget);
    const result = WebPasswordLoginRequestSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!result.success) {
      const nextFieldErrors: FieldErrors = {};

      for (const issue of result.error.issues) {
        const field = issue.path[0];

        if (field === "email" || field === "password") {
          nextFieldErrors[field] ??= issue.message;
        }
      }

      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});

    startPasswordTransition(async () => {
      try {
        await loginWeb(result.data);
        router.replace("/chats");
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof HttpRequestError
            ? error.message
            : "登录请求失败，请确认 API 服务已启动后重试",
        );
      }
    });
  }

  return (
    <main className="moodmate moodmate-auth">
      <header className="moodmate-auth__topnav">
        <div className="moodmate-auth__container moodmate-auth__topnav-inner">
          <div aria-label="MoodMate" className="moodmate-auth__brand">
            <span aria-hidden="true" className="moodmate-auth__brand-mark">
              M
            </span>
            <span>MoodMate</span>
          </div>
          <ThemeToggle
            className="moodmate-auth__theme-toggle"
            variant="ghost"
          />
        </div>
      </header>

      <section className="moodmate-auth__stage">
        <div
          aria-hidden="true"
          className="moodmate-auth__presence moodmate-auth__presence--left"
        >
          有人在等你
        </div>
        <div
          aria-hidden="true"
          className="moodmate-auth__presence moodmate-auth__presence--right"
        >
          <span>继续未说完的话</span>
          <span className="moodmate-auth__presence-line" />
        </div>

        <div className="moodmate-auth__container moodmate-auth__hero">
          {stage === "welcome" ? (
            <div className="moodmate-auth__welcome">
              <p className="moodmate-auth__eyebrow">
                PRIVATE SPACE · 朋友陪伴空间
              </p>
              <h1>回来就好，我们继续聊。</h1>
              <p className="moodmate-auth__lead">
                登录后，你可以继续和朋友聊天，也能接着查看之前的对话。
              </p>
              <div className="moodmate-auth__hero-action">
                <Button
                  className="moodmate-auth__primary-button"
                  onClick={showLogin}
                  ref={enterButtonRef}
                  size="lg"
                  type="button"
                >
                  <span>进入 MoodMate</span>
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
              <p className="moodmate-auth__quiet-note">准备好时再开始。</p>
            </div>
          ) : (
            <section
              aria-labelledby="login-title"
              className="moodmate-auth__panel"
              role="region"
            >
              <div className="moodmate-auth__panel-head">
                <p className="moodmate-auth__panel-kicker">欢迎回来</p>
                <h1 id="login-title">选择进入方式</h1>
                <p>登录后，可以继续之前的对话，也能查看你的朋友列表。</p>
              </div>

              <div className="moodmate-auth__panel-body">
                <div className="moodmate-auth__providers">
                  <Button
                    className="moodmate-auth__provider"
                    disabled={isPasswordPending}
                    onClick={() => showOauthUnavailable("GitHub")}
                    ref={firstLoginControlRef}
                    type="button"
                    variant="outline"
                  >
                    <FaGithub aria-hidden="true" />
                    <span>使用 GitHub 登录</span>
                    <small>暂未开放</small>
                    <ChevronRight aria-hidden="true" />
                  </Button>
                  <Button
                    className="moodmate-auth__provider"
                    disabled={isPasswordPending}
                    onClick={() => showOauthUnavailable("Google")}
                    type="button"
                    variant="outline"
                  >
                    <FaGoogle aria-hidden="true" />
                    <span>使用 Google 登录</span>
                    <small>暂未开放</small>
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </div>

                {oauthMessage ? (
                  <Alert className="moodmate-auth__notice" variant="info">
                    <AlertDescription>{oauthMessage}</AlertDescription>
                  </Alert>
                ) : null}

                <div aria-hidden="true" className="moodmate-auth__divider">
                  <span />
                  <span>邮箱登录</span>
                  <span />
                </div>

                <form
                  aria-busy={isPasswordPending}
                  className="moodmate-auth__form"
                  noValidate
                  onSubmit={handleSubmit}
                >
                  <Field>
                    <FieldLabel htmlFor="email">邮箱</FieldLabel>
                    <Input
                      aria-describedby={
                        fieldErrors.email ? "web-login-email-error" : undefined
                      }
                      aria-invalid={Boolean(fieldErrors.email)}
                      autoComplete="username"
                      className="moodmate-auth__input"
                      disabled={isPasswordPending}
                      id="email"
                      inputMode="email"
                      maxLength={254}
                      name="email"
                      placeholder="name@example.com"
                      required
                      type="email"
                    />
                    {fieldErrors.email ? (
                      <FieldError id="web-login-email-error">
                        {fieldErrors.email}
                      </FieldError>
                    ) : null}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="password">密码</FieldLabel>
                    <Input
                      aria-describedby={
                        fieldErrors.password
                          ? "web-login-password-error"
                          : undefined
                      }
                      aria-invalid={Boolean(fieldErrors.password)}
                      autoComplete="current-password"
                      className="moodmate-auth__input"
                      disabled={isPasswordPending}
                      id="password"
                      maxLength={128}
                      minLength={8}
                      name="password"
                      placeholder="8 到 128 个字符"
                      required
                      type="password"
                    />
                    {fieldErrors.password ? (
                      <FieldError id="web-login-password-error">
                        {fieldErrors.password}
                      </FieldError>
                    ) : null}
                  </Field>

                  {errorMessage ? (
                    <Alert className="moodmate-auth__notice" variant="danger">
                      <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                  ) : null}

                  <Button
                    className="moodmate-auth__submit"
                    disabled={isPasswordPending}
                    size="lg"
                    type="submit"
                  >
                    {isPasswordPending ? "正在登录" : "使用邮箱登录"}
                  </Button>
                </form>

                <p className="moodmate-auth__terms">
                  登录即表示你同意服务条款和隐私政策。
                </p>
              </div>

              <footer className="moodmate-auth__panel-foot">
                <button
                  className="moodmate-auth__back"
                  disabled={isPasswordPending}
                  onClick={showWelcome}
                  type="button"
                >
                  <ArrowLeft aria-hidden="true" />
                  返回
                </button>
                <span className="moodmate-auth__secure-note">
                  <LockKeyhole aria-hidden="true" />
                  安全登录
                </span>
              </footer>
            </section>
          )}
        </div>

        <footer className="moodmate-auth__page-foot">
          <span>MOODMATE · 朋友陪伴空间</span>
          <span>对话内容默认仅你可见</span>
        </footer>
      </section>
    </main>
  );
}
