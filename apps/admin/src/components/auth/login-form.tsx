"use client";

import { AdminPasswordLoginRequestSchema } from "@repo/contracts";
import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { Field, FieldLabel } from "@repo/ui/field";
import { Input } from "@repo/ui/input";
import { ThemeMenu } from "@repo/ui/theme-menu";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";

import { loginAdmin } from "@/src/auth/api";
import { adminSessionKeys } from "@/src/auth/session.query";
import { HttpRequestError } from "@/src/lib/http";

const ADMIN_MODULES = [
  { number: "01", name: "情绪记录" },
  { number: "02", name: "用户管理" },
  { number: "03", name: "角色权限" },
] as const;

type FieldErrors = {
  email: string | null;
  password: string | null;
};

const EMPTY_FIELD_ERRORS: FieldErrors = {
  email: null,
  password: null,
};

function getEmailError(input: HTMLInputElement) {
  return input.value.trim() && input.validity.valid
    ? null
    : "请输入有效的邮箱地址";
}

function getPasswordError(value: string) {
  const length = Array.from(value).length;

  return length >= 8 && length <= 128 ? null : "密码长度必须为 8 到 128 个字符";
}

export function LoginForm() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] =
    useState<FieldErrors>(EMPTY_FIELD_ERRORS);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const emailInput = event.currentTarget.elements.namedItem("email");
    const passwordInput = event.currentTarget.elements.namedItem("password");

    if (
      !(emailInput instanceof HTMLInputElement) ||
      !(passwordInput instanceof HTMLInputElement)
    ) {
      setErrorMessage("登录表单加载失败，请刷新页面后重试");
      return;
    }

    const nextFieldErrors = {
      email: getEmailError(emailInput),
      password: getPasswordError(passwordInput.value),
    };

    setFieldErrors(nextFieldErrors);

    if (nextFieldErrors.email || nextFieldErrors.password) {
      const invalidInput = nextFieldErrors.email ? emailInput : passwordInput;
      window.requestAnimationFrame(() => invalidInput.focus());
      return;
    }

    const result = AdminPasswordLoginRequestSchema.safeParse({
      email: emailInput.value,
      password: passwordInput.value,
    });

    if (!result.success) {
      setErrorMessage(result.error.issues[0]?.message ?? "请检查登录信息");
      return;
    }

    emailInput.value = result.data.email;

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
    <main className="admin-login-canvas relative isolate min-h-svh overflow-x-hidden px-5 py-[clamp(0.875rem,2.2vw,1.875rem)] text-foreground max-[560px]:px-[1.125rem] md:px-[clamp(2rem,4vw,4rem)]">
      <div className="admin-login-frame">
        <header className="flex min-h-[3.625rem] items-center gap-2.5 border-b border-border px-4 max-[560px]:px-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid size-[1.875rem] shrink-0 place-items-center rounded-md bg-primary text-[0.9375rem] font-semibold text-primary-foreground"
            >
              M
            </span>
            <span className="text-[0.9375rem] font-semibold">moodmate</span>
            <span className="inline-flex h-[1.3125rem] items-center rounded-sm border border-border px-[0.4375rem] text-[0.625rem] font-medium tracking-[0.08em] text-muted uppercase">
              admin
            </span>
          </div>
          <ThemeMenu className="ml-auto [&>button]:size-[2.375rem] [&>button]:min-h-[2.375rem]" />
        </header>

        <section className="admin-login-body mx-auto grid w-full max-w-[73.75rem] items-center gap-6 px-5 py-7 min-[561px]:gap-9 min-[561px]:px-8 min-[561px]:py-10 min-[861px]:grid-cols-[minmax(0,1fr)_minmax(22.5rem,26.875rem)] min-[861px]:gap-[clamp(3rem,8vw,8rem)] min-[861px]:px-[clamp(2rem,5vw,4.5rem)] min-[861px]:py-[clamp(3rem,8vh,5.75rem)]">
          <div className="max-w-[38.125rem]">
            <p className="mb-2.5 text-[0.6875rem] font-semibold tracking-[0.08em] text-muted uppercase min-[561px]:mb-4">
              管理员身份验证
            </p>
            <h1 className="text-[clamp(2.125rem,4.4vw,3.625rem)] leading-[1.06] font-semibold tracking-normal">
              <span className="block">进入</span>
              <span className="block">MoodMate 管理台</span>
            </h1>
            <p className="mt-3 max-w-[50ch] text-[0.84375rem] leading-[1.7] text-muted min-[561px]:mt-6 min-[561px]:text-[0.9375rem]">
              使用管理员账号继续。登录后可以处理情绪记录、用户账号与角色权限。
            </p>

            <div
              aria-label="管理台模块"
              className="mt-7 hidden grid-cols-3 border-t border-border min-[561px]:grid min-[861px]:mt-[clamp(2.5rem,6vh,4.25rem)]"
            >
              {ADMIN_MODULES.map((module) => (
                <div
                  className="min-w-0 pt-4 pr-[1.125rem] [&+&]:border-l [&+&]:border-border [&+&]:pl-[1.125rem]"
                  key={module.number}
                >
                  <span className="mb-[0.4375rem] block text-[0.625rem] tracking-[0.08em] text-muted">
                    {module.number}
                  </span>
                  <span className="block text-xs font-medium">
                    {module.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Card className="w-full overflow-hidden rounded-lg">
            <CardHeader className="gap-0 border-b border-border px-5 pt-[1.375rem] pb-[1.125rem] min-[561px]:px-[1.625rem] min-[561px]:pt-[1.5625rem] min-[561px]:pb-5">
              <CardTitle className="text-xl leading-6 tracking-normal">
                账号登录
              </CardTitle>
              <CardDescription className="mt-[0.4375rem] text-[0.78125rem] leading-[1.6]">
                输入管理员邮箱和密码。
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <form
                aria-busy={isPending}
                className="grid gap-[1.125rem] px-5 pt-[1.3125rem] pb-[1.375rem] min-[561px]:px-[1.625rem] min-[561px]:pt-6 min-[561px]:pb-[1.625rem]"
                noValidate
                onSubmit={handleSubmit}
              >
                <Field className="gap-0">
                  <div className="mb-1.5 flex items-center gap-3">
                    <FieldLabel className="m-0" htmlFor="email">
                      邮箱
                    </FieldLabel>
                    <span className="ml-auto text-[0.65625rem] text-muted">
                      管理员账号
                    </span>
                  </div>
                  <Input
                    aria-describedby={
                      fieldErrors.email ? "email-error" : undefined
                    }
                    aria-invalid={Boolean(fieldErrors.email)}
                    autoComplete="username"
                    autoFocus
                    className="h-[2.875rem] min-h-[2.875rem] px-[0.8125rem] text-[0.84375rem] disabled:cursor-wait disabled:bg-surface-muted"
                    disabled={isPending}
                    id="email"
                    inputMode="email"
                    maxLength={254}
                    name="email"
                    onBlur={(event) => {
                      const input = event.currentTarget;

                      setFieldErrors((current) => ({
                        ...current,
                        email: getEmailError(input),
                      }));
                    }}
                    onChange={(event) => {
                      if (!fieldErrors.email) return;
                      const input = event.currentTarget;

                      setFieldErrors((current) => ({
                        ...current,
                        email: getEmailError(input),
                      }));
                    }}
                    placeholder="name@example.com"
                    required
                    type="email"
                  />
                  {fieldErrors.email ? (
                    <p
                      className="mt-1.5 text-[0.71875rem] leading-[1.5] text-danger"
                      id="email-error"
                      role="alert"
                    >
                      {fieldErrors.email}
                    </p>
                  ) : null}
                </Field>

                <Field className="gap-0">
                  <div className="mb-1.5 flex items-center gap-3">
                    <FieldLabel className="m-0" htmlFor="password">
                      密码
                    </FieldLabel>
                    <span className="ml-auto text-[0.65625rem] text-muted">
                      8-128 个字符
                    </span>
                  </div>
                  <div className="relative">
                    <Input
                      aria-describedby={
                        fieldErrors.password ? "password-error" : undefined
                      }
                      aria-invalid={Boolean(fieldErrors.password)}
                      autoComplete="current-password"
                      className="h-[2.875rem] min-h-[2.875rem] pr-[3.125rem] pl-[0.8125rem] text-[0.84375rem] disabled:cursor-wait disabled:bg-surface-muted"
                      disabled={isPending}
                      id="password"
                      maxLength={128}
                      minLength={8}
                      name="password"
                      onBlur={(event) => {
                        const { value } = event.currentTarget;

                        if (!value) return;
                        setFieldErrors((current) => ({
                          ...current,
                          password: getPasswordError(value),
                        }));
                      }}
                      onChange={(event) => {
                        if (!fieldErrors.password) return;
                        const { value } = event.currentTarget;

                        setFieldErrors((current) => ({
                          ...current,
                          password: getPasswordError(value),
                        }));
                      }}
                      ref={passwordRef}
                      required
                      type={showPassword ? "text" : "password"}
                    />
                    <button
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                      aria-pressed={showPassword}
                      className="absolute top-px right-px grid size-11 place-items-center rounded-md border-0 bg-transparent text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset disabled:cursor-wait disabled:opacity-60"
                      disabled={isPending}
                      onClick={() => {
                        setShowPassword((current) => !current);
                        passwordRef.current?.focus();
                      }}
                      type="button"
                    >
                      {showPassword ? (
                        <EyeOff
                          aria-hidden="true"
                          className="size-[1.125rem]"
                        />
                      ) : (
                        <Eye aria-hidden="true" className="size-[1.125rem]" />
                      )}
                    </button>
                  </div>
                  {fieldErrors.password ? (
                    <p
                      className="mt-1.5 text-[0.71875rem] leading-[1.5] text-danger"
                      id="password-error"
                      role="alert"
                    >
                      {fieldErrors.password}
                    </p>
                  ) : null}
                </Field>

                {errorMessage ? (
                  <Alert className="py-2.5 text-xs leading-5" variant="danger">
                    {errorMessage}
                  </Alert>
                ) : null}

                <Button
                  aria-busy={isPending}
                  className="mt-0.5 h-[2.875rem] w-full"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-[0.9375rem] animate-spin"
                    />
                  ) : null}
                  <span>{isPending ? "正在登录" : "登录管理台"}</span>
                  {isPending ? null : (
                    <ArrowRight aria-hidden="true" className="size-4" />
                  )}
                </Button>

                <p className="pt-0.5 text-center text-[0.71875rem] leading-[1.6] text-muted">
                  登录遇到问题？联系{" "}
                  <a
                    className="text-foreground underline underline-offset-[3px] hover:decoration-2 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    href="mailto:support@moodmate.app"
                  >
                    support@moodmate.app
                  </a>
                </p>
              </form>
            </CardContent>
          </Card>
        </section>

        <footer className="flex min-h-[3.25rem] flex-wrap items-center gap-3 border-t border-border px-4 py-3.5 text-[0.65625rem] tracking-[0.02em] text-muted sm:px-5">
          <span>MoodMate 管理员专用入口</span>
          <span className="ml-auto max-[560px]:ml-0 max-[560px]:w-full">
            仅限授权账号
          </span>
        </footer>
      </div>
    </main>
  );
}
