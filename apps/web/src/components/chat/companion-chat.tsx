"use client";

import { useChat } from "@ai-sdk/react";
import type { WebSession, WebUserProfile } from "@repo/contracts";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { TextStreamChatTransport, type UIMessage } from "ai";
import {
  Bot,
  ChevronLeft,
  LogOut,
  MessageCircle,
  Settings2,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";

import { clearClientSession } from "@/src/auth/client-session";
import { readEnabledLocalLlmConfig } from "@/src/auth/local-llm-config";
import { getWebClientEnv } from "@/src/env/client";
import { fetchWithClientSession } from "@/src/lib/http";

import { ChatComposer } from "./chat-composer";
import { ChatConversation } from "./chat-conversation";
import { LlmSettings } from "./llm-settings";

type AppView = "chat" | "settings" | "account";

interface CompanionChatAppProps {
  profile: WebUserProfile;
  session: WebSession;
}

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function CompanionChatApp({ profile, session }: CompanionChatAppProps) {
  const [activeView, setActiveView] = useState<AppView>("chat");
  const [draft, setDraft] = useState("");
  const transport = useMemo(
    () =>
      new TextStreamChatTransport<UIMessage>({
        api: `${getWebClientEnv().NEXT_PUBLIC_API_BASE_URL}/rpc/chat/companion`,
        fetch: fetchWithClientSession,
        prepareSendMessagesRequest({ api, body, messages }) {
          const llmConfig = readEnabledLocalLlmConfig();

          return {
            api,
            body: {
              ...body,
              messages: messages.slice(-20),
              ...(llmConfig ? { llmConfig } : {}),
            },
          };
        },
      }),
    [],
  );
  const { clearError, error, messages, sendMessage, status, stop } = useChat({
    transport,
  });
  const isSending = status === "submitted" || status === "streaming";

  function handleSend() {
    const text = draft.trim();

    if (!text || isSending) {
      return;
    }

    clearError();
    setDraft("");
    void sendMessage({ text });
  }

  function handleLogout() {
    clearClientSession();
    window.location.replace("/login");
  }

  return (
    <main className="h-svh overflow-hidden bg-background text-foreground lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="hidden min-h-0 border-r border-border bg-surface lg:flex lg:flex-col">
        <div className="flex min-h-16 items-center gap-2 border-b border-border px-5">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <MessageCircle aria-hidden="true" className="size-4" />
          </span>
          <span className="font-semibold">moodmate</span>
        </div>

        <nav aria-label="应用导航" className="grid gap-1 p-3">
          <NavButton
            active={activeView === "chat"}
            icon={MessageCircle}
            label="对话"
            onClick={() => setActiveView("chat")}
          />
          <NavButton
            active={activeView === "settings"}
            icon={Settings2}
            label="LLM 设置"
            onClick={() => setActiveView("settings")}
          />
          <NavButton
            active={activeView === "account"}
            icon={UserRound}
            label="账号"
            onClick={() => setActiveView("account")}
          />
        </nav>

        <div className="mt-2 border-y border-border p-3">
          <button
            className="flex w-full items-center gap-3 rounded-md bg-primary-subtle px-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus"
            onClick={() => setActiveView("chat")}
            type="button"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <Bot aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">MoodMate</span>
              <span className="block truncate text-xs text-muted">
                你的 AI 伴侣
              </span>
            </span>
          </button>
        </div>

        <div className="mt-auto grid gap-3 border-t border-border p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-muted text-sm font-semibold">
              {profile.displayName.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {profile.displayName}
              </span>
              <span className="block truncate text-xs text-muted">
                {profile.email}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <ThemeToggle />
            <Button
              aria-label="退出登录"
              onClick={handleLogout}
              size="icon"
              title="退出登录"
              variant="ghost"
            >
              <LogOut aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex h-svh min-h-0 flex-col">
        <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
          {activeView === "chat" ? (
            <span className="grid size-8 place-items-center rounded-full bg-primary-subtle text-primary-strong">
              <Bot aria-hidden="true" className="size-4" />
            </span>
          ) : (
            <button
              aria-label="返回对话"
              className="grid size-9 place-items-center rounded-md text-muted outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus"
              onClick={() => setActiveView("chat")}
              title="返回对话"
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {activeView === "chat"
                ? "MoodMate"
                : activeView === "settings"
                  ? "LLM 设置"
                  : "账号"}
            </p>
            {activeView === "chat" ? (
              <p className="text-xs text-muted">AI 伴侣</p>
            ) : null}
          </div>
          <ThemeToggle className="ml-auto" />
        </header>

        {activeView === "chat" ? (
          <section className="flex min-h-0 flex-1 flex-col">
            <header className="hidden min-h-16 shrink-0 items-center gap-3 border-b border-border px-6 lg:flex">
              <span className="grid size-9 place-items-center rounded-full bg-primary-subtle text-primary-strong">
                <Bot aria-hidden="true" className="size-4" />
              </span>
              <div>
                <h1 className="text-sm font-semibold">MoodMate</h1>
                <p className="text-xs text-muted">AI 伴侣</p>
              </div>
              <Badge className="ml-auto" variant="outline">
                流式对话
              </Badge>
            </header>

            <ChatConversation messages={messages} status={status} />

            {error ? (
              <div
                className="mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm sm:mx-6"
                role="alert"
              >
                <p className="min-w-0 flex-1">
                  回复生成失败。请检查 LLM 配置或稍后重试。
                </p>
                <Button
                  onClick={() => setActiveView("settings")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  检查配置
                </Button>
                <Button
                  onClick={clearError}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  关闭
                </Button>
              </div>
            ) : null}

            <ChatComposer
              isSending={isSending}
              onChange={setDraft}
              onStop={() => void stop()}
              onSubmit={handleSend}
              value={draft}
            />
          </section>
        ) : null}

        {activeView === "settings" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <LlmSettings />
          </div>
        ) : null}

        {activeView === "account" ? (
          <section className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-2xl px-4 py-7 sm:px-6 sm:py-10">
              <div className="border-b border-border pb-5">
                <h2 className="text-xl font-semibold">账号</h2>
                <p className="mt-2 text-sm text-muted">当前登录信息</p>
              </div>
              <dl className="divide-y divide-border py-3 text-sm">
                <AccountRow label="昵称" value={profile.displayName} />
                <AccountRow label="邮箱" value={profile.email} />
                <AccountRow label="身份" value={profile.roles.join("、")} />
                <AccountRow
                  label="会话有效期"
                  value={dateTimeFormatter.format(
                    new Date(session.expiresAtMs),
                  )}
                />
              </dl>
              <Button
                className="mt-5 min-h-11"
                onClick={handleLogout}
                type="button"
                variant="danger"
              >
                <LogOut aria-hidden="true" className="size-4" />
                退出登录
              </Button>
            </div>
          </section>
        ) : null}

        <nav
          aria-label="移动端导航"
          className="grid shrink-0 grid-cols-3 border-t border-border bg-surface pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
        >
          <MobileNavButton
            active={activeView === "chat"}
            icon={MessageCircle}
            label="对话"
            onClick={() => setActiveView("chat")}
          />
          <MobileNavButton
            active={activeView === "settings"}
            icon={Settings2}
            label="设置"
            onClick={() => setActiveView("settings")}
          />
          <MobileNavButton
            active={activeView === "account"}
            icon={UserRound}
            label="账号"
            onClick={() => setActiveView("account")}
          />
        </nav>
      </div>
    </main>
  );
}

function NavButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof MessageCircle;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus ${
        active
          ? "bg-primary-subtle text-primary-strong"
          : "text-muted hover:bg-surface-muted hover:text-foreground"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}

function MobileNavButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof MessageCircle;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={`flex min-h-14 flex-col items-center justify-center gap-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${
        active ? "text-primary-strong" : "text-muted"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}

function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="break-words sm:text-right">{value}</dd>
    </div>
  );
}
