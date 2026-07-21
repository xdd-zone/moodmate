"use client";

import { WebPasswordLoginRequestSchema } from "@repo/contracts";
import { Alert, AlertDescription } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { Field, FieldError, FieldLabel } from "@repo/ui/field";
import { Input } from "@repo/ui/input";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { FormEvent } from "react";

import { readClientSession } from "@/src/auth/client-session";
import { loginWeb } from "@/src/auth/login-client";
import { HttpRequestError } from "@/src/lib/http";

type FieldErrors = {
  email?: string;
  password?: string;
};

export function LoginForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (readClientSession()) {
      router.replace("/app");
    }
  }, [router]);

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

    startTransition(async () => {
      try {
        await loginWeb(result.data);
        router.replace("/app");
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

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(340px,430px)] lg:gap-[clamp(48px,9vw,120px)] lg:py-16">
          <section className="max-w-2xl animate-rise-soft">
            <p className="mb-4 text-sm font-medium text-primary-strong">
              回到你的记录
            </p>
            <h1 className="text-[clamp(2.5rem,6vw,4.75rem)] leading-[1.04] font-semibold text-balance">
              登录后，继续写下今天。
            </h1>
            <p className="mt-6 max-w-[54ch] text-base leading-7 text-muted md:text-lg md:leading-8">
              在安静一点的地方，写清今天发生了什么，再决定下一步。
            </p>

            <div className="mt-9 grid max-w-lg grid-cols-3 border-y border-border py-4 text-sm">
              <span>情绪</span>
              <span className="border-l border-border pl-4">原因</span>
              <span className="border-l border-border pl-4">下一步</span>
            </div>
          </section>

          <Card className="w-full animate-rise-soft overflow-hidden [animation-delay:100ms]">
            <CardHeader className="border-b border-border px-5 py-5 sm:px-6">
              <CardTitle className="text-xl">账号登录</CardTitle>
              <CardDescription>输入邮箱和密码继续。</CardDescription>
            </CardHeader>
            <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
              <form
                aria-busy={isPending}
                className="grid gap-5"
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
                    autoFocus
                    disabled={isPending}
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
                    disabled={isPending}
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
                  <Alert variant="danger">
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                ) : null}

                <Button className="w-full" disabled={isPending} type="submit">
                  {isPending ? "正在登录" : "登录并继续"}
                </Button>

                <Button asChild className="w-full" variant="ghost">
                  <Link href="/">返回首页</Link>
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
