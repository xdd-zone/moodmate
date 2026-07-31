"use client";

import { WebPasswordLoginRequestSchema } from "@repo/contracts";
import { Button } from "@repo/ui/button";
import { Field, FieldError, FieldLabel } from "@repo/ui/field";
import { Input } from "@repo/ui/input";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import {
  ArrowRight,
  ChevronRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { FaGithub, FaGoogle } from "react-icons/fa6";

import { readClientSession } from "@/src/auth/client-session";
import { loginWeb, redirectToGithubLogin } from "@/src/auth/login-client";
import { HttpRequestError } from "@/src/lib/http";

type AuthMode = "email" | "oauth";

type FieldErrors = {
  email?: string;
  password?: string;
};

type LoginStage = "leaving" | "login" | "welcome";

export function LoginForm() {
  const router = useRouter();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const emailTabRef = useRef<HTMLButtonElement>(null);
  const enterButtonRef = useRef<HTMLButtonElement>(null);
  const hasOpenedLoginRef = useRef(false);
  const oauthTabRef = useRef<HTMLButtonElement>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("email");
  const [stage, setStage] = useState<LoginStage>("welcome");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isGithubPending, startGithubTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();
  const isPending = isGithubPending || isPasswordPending;

  useEffect(() => {
    if (readClientSession()) {
      router.replace("/chats");
    }
  }, [router]);

  useEffect(() => {
    if (stage !== "leaving") return;

    const timeoutId = window.setTimeout(() => {
      setStage("login");
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [stage]);

  useEffect(() => {
    if (stage === "login") {
      hasOpenedLoginRef.current = true;
      emailInputRef.current?.focus();
      return;
    }

    if (stage === "welcome" && hasOpenedLoginRef.current) {
      enterButtonRef.current?.focus();
    }
  }, [stage]);

  useEffect(() => {
    if (stage !== "login") return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || isPending) return;

      setStage("welcome");
      setAuthMode("email");
      setErrorMessage(null);
      setOauthMessage(null);
      setFieldErrors({});
      setIsPasswordVisible(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPending, stage]);

  function showLogin() {
    setStage("leaving");
  }

  function showWelcome() {
    if (isPending) return;

    setStage("welcome");
    setAuthMode("email");
    setErrorMessage(null);
    setOauthMessage(null);
    setFieldErrors({});
    setIsPasswordVisible(false);
  }

  function changeAuthMode(mode: AuthMode) {
    if (isPending) return;

    setAuthMode(mode);
    setErrorMessage(null);
    setOauthMessage(null);
  }

  function handleAuthTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const nextMode = authMode === "email" ? "oauth" : "email";

    changeAuthMode(nextMode);
    (nextMode === "email" ? emailTabRef : oauthTabRef).current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

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
            : "邮箱登录请求失败，请确认 API 服务已启动后重试",
        );
      }
    });
  }

  function handleGithubLogin() {
    setOauthMessage(null);

    startGithubTransition(async () => {
      try {
        await redirectToGithubLogin();
      } catch (error) {
        setOauthMessage(
          error instanceof HttpRequestError
            ? error.message
            : "无法连接 GitHub，请确认 API 配置后重试",
        );
      }
    });
  }

  function handleGoogleLogin() {
    setOauthMessage("Google 登录暂未开放，请使用 GitHub 或邮箱登录。");
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
          {stage === "login" ? (
            <section
              aria-labelledby="login-title"
              className="moodmate-auth__panel"
              role="region"
            >
              <div className="moodmate-auth__panel-head">
                <p className="moodmate-auth__panel-kicker">欢迎回来</p>
                <h2 id="login-title">登录 MoodMate</h2>
                <p>选择常用方式，继续之前的对话。</p>
              </div>

              <div className="moodmate-auth__panel-body">
                <div
                  aria-label="登录方式"
                  className="moodmate-auth__switcher"
                  data-mode={authMode}
                  role="tablist"
                >
                  <span
                    aria-hidden="true"
                    className="moodmate-auth__switcher-indicator"
                  />
                  <button
                    aria-controls="email-login-view"
                    aria-selected={authMode === "email"}
                    className="moodmate-auth__tab"
                    disabled={isPending}
                    id="email-login-tab"
                    onClick={() => changeAuthMode("email")}
                    onKeyDown={handleAuthTabKeyDown}
                    ref={emailTabRef}
                    role="tab"
                    tabIndex={authMode === "email" ? 0 : -1}
                    type="button"
                  >
                    邮箱登录
                  </button>
                  <button
                    aria-controls="oauth-login-view"
                    aria-selected={authMode === "oauth"}
                    className="moodmate-auth__tab"
                    disabled={isPending}
                    id="oauth-login-tab"
                    onClick={() => changeAuthMode("oauth")}
                    onKeyDown={handleAuthTabKeyDown}
                    ref={oauthTabRef}
                    role="tab"
                    tabIndex={authMode === "oauth" ? 0 : -1}
                    type="button"
                  >
                    GitHub / Google
                  </button>
                </div>

                <div className="moodmate-auth__viewport">
                  <div
                    aria-hidden={authMode !== "email"}
                    aria-labelledby="email-login-tab"
                    className={`moodmate-auth__view moodmate-auth__view--email${authMode === "email" ? " is-active" : ""}`}
                    id="email-login-view"
                    inert={authMode !== "email"}
                    role="tabpanel"
                  >
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
                            fieldErrors.email
                              ? "web-login-email-error"
                              : undefined
                          }
                          aria-invalid={Boolean(fieldErrors.email)}
                          autoComplete="email"
                          className="moodmate-auth__input"
                          disabled={isPending}
                          id="email"
                          inputMode="email"
                          maxLength={254}
                          name="email"
                          placeholder="name@example.com"
                          ref={emailInputRef}
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
                        <div className="moodmate-auth__password-wrap">
                          <Input
                            aria-describedby={
                              fieldErrors.password
                                ? "web-login-password-error"
                                : undefined
                            }
                            aria-invalid={Boolean(fieldErrors.password)}
                            autoComplete="current-password"
                            className="moodmate-auth__input moodmate-auth__input--password"
                            disabled={isPending}
                            id="password"
                            maxLength={128}
                            minLength={8}
                            name="password"
                            placeholder="输入密码"
                            required
                            type={isPasswordVisible ? "text" : "password"}
                          />
                          <button
                            aria-label={
                              isPasswordVisible ? "隐藏密码" : "显示密码"
                            }
                            className="moodmate-auth__password-toggle"
                            disabled={isPending}
                            onClick={() =>
                              setIsPasswordVisible((visible) => !visible)
                            }
                            title={isPasswordVisible ? "隐藏密码" : "显示密码"}
                            type="button"
                          >
                            {isPasswordVisible ? (
                              <EyeOff aria-hidden="true" />
                            ) : (
                              <Eye aria-hidden="true" />
                            )}
                          </button>
                        </div>
                        {fieldErrors.password ? (
                          <FieldError id="web-login-password-error">
                            {fieldErrors.password}
                          </FieldError>
                        ) : null}
                      </Field>

                      <Button
                        className="moodmate-auth__submit"
                        disabled={isPending}
                        size="lg"
                        type="submit"
                      >
                        <span>{isPasswordPending ? "正在登录…" : "登录"}</span>
                        {isPasswordPending ? (
                          <LoaderCircle
                            aria-hidden="true"
                            className="moodmate-auth__spinner"
                          />
                        ) : (
                          <ArrowRight aria-hidden="true" />
                        )}
                      </Button>
                      <p
                        aria-live="polite"
                        className={`moodmate-auth__form-status${errorMessage ? " is-error" : ""}`}
                        role={errorMessage ? "alert" : "status"}
                      >
                        {errorMessage ??
                          (isPasswordPending ? "正在验证账号信息" : "")}
                      </p>
                    </form>
                  </div>

                  <div
                    aria-hidden={authMode !== "oauth"}
                    aria-labelledby="oauth-login-tab"
                    className={`moodmate-auth__view moodmate-auth__view--oauth${authMode === "oauth" ? " is-active" : ""}`}
                    id="oauth-login-view"
                    inert={authMode !== "oauth"}
                    role="tabpanel"
                  >
                    <div className="moodmate-auth__providers">
                      <Button
                        aria-busy={isGithubPending}
                        className="moodmate-auth__provider"
                        disabled={isPending}
                        onClick={handleGithubLogin}
                        type="button"
                        variant="outline"
                      >
                        <FaGithub aria-hidden="true" />
                        <span>
                          {isGithubPending
                            ? "正在连接 GitHub…"
                            : "使用 GitHub 登录"}
                        </span>
                        {isGithubPending ? (
                          <LoaderCircle
                            aria-hidden="true"
                            className="moodmate-auth__spinner"
                          />
                        ) : (
                          <ChevronRight aria-hidden="true" />
                        )}
                      </Button>
                      <Button
                        className="moodmate-auth__provider"
                        disabled={isPending}
                        onClick={handleGoogleLogin}
                        type="button"
                        variant="outline"
                      >
                        <FaGoogle aria-hidden="true" />
                        <span>使用 Google 登录</span>
                        <ChevronRight aria-hidden="true" />
                      </Button>
                    </div>
                    <p
                      aria-live="polite"
                      className={`moodmate-auth__form-status${oauthMessage ? " is-error" : ""}`}
                      role={oauthMessage ? "alert" : "status"}
                    >
                      {oauthMessage ?? ""}
                    </p>
                  </div>
                </div>

                <p className="moodmate-auth__terms">
                  继续登录即表示你同意服务条款和隐私政策。
                </p>
              </div>

              <footer className="moodmate-auth__panel-foot">
                <button
                  className="moodmate-auth__back"
                  disabled={isPending}
                  onClick={showWelcome}
                  type="button"
                >
                  返回
                </button>
                <span className="moodmate-auth__secure-note">
                  <LockKeyhole aria-hidden="true" />
                  安全登录
                </span>
              </footer>
            </section>
          ) : (
            <div
              className={`moodmate-auth__welcome${stage === "leaving" ? " is-leaving" : ""}`}
            >
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
                  disabled={stage === "leaving"}
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
