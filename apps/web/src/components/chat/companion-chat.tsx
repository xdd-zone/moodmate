"use client";

import { useChat } from "@ai-sdk/react";
import type {
  CompanionConversationResponse,
  WebSession,
  WebUserProfile,
} from "@repo/contracts";
import { Button } from "@repo/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TextStreamChatTransport, type UIMessage } from "ai";
import {
  Bot,
  Brain,
  ChevronLeft,
  History,
  LoaderCircle,
  MessageCircle,
  Palette,
  Search,
  Settings2,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";

import { getCompanionConversationMessages } from "@/src/api/chat.api";
import {
  companionChatKeys,
  companionConversationQueryOptions,
} from "@/src/api/chat.query";
import { clearClientSession } from "@/src/auth/client-session";
import {
  AppearancePanel,
  GeneralPanel,
  MemoryPanel,
  ProfilePanel,
} from "@/src/components/settings/settings-panels";
import { getWebClientEnv } from "@/src/env/client";
import { fetchWithClientSession } from "@/src/lib/http";

import { ChatComposer } from "./chat-composer";
import { ChatConversation } from "./chat-conversation";

type AppMode = "chat" | "settings";
type SettingsSection = "profile" | "general" | "memory" | "appearance";

const AGENT_NAME = "MoodMate";
const AGENT_SUBTITLE = "你的 AI 伴侣";

function getRelationshipStageLabel(messageCount: number) {
  if (messageCount >= 80) {
    return "亲密连结";
  }
  if (messageCount >= 36) {
    return "稳定信任";
  }
  if (messageCount >= 16) {
    return "舒适陪伴";
  }
  if (messageCount >= 6) {
    return "升温熟悉";
  }
  return "初识破冰";
}

interface CompanionChatAppProps {
  profile: WebUserProfile;
  session: WebSession;
}

interface SettingsMenuEntry {
  icon: typeof MessageCircle;
  label: string;
  section: SettingsSection;
}

const settingsMenu: SettingsMenuEntry[] = [
  { icon: UserRound, label: "个人资料", section: "profile" },
  { icon: SlidersHorizontal, label: "General", section: "general" },
  { icon: Brain, label: "记忆", section: "memory" },
  { icon: Palette, label: "Appearance", section: "appearance" },
];

const settingsTitle: Record<SettingsSection, string> = {
  appearance: "Appearance",
  general: "General",
  memory: "记忆",
  profile: "个人资料",
};

export function CompanionChatApp({ profile, session }: CompanionChatAppProps) {
  const conversationQuery = useQuery(companionConversationQueryOptions());

  if (conversationQuery.isPending) {
    return <ConversationLoadingState />;
  }

  if (conversationQuery.isError) {
    return (
      <ConversationErrorState
        onRetry={() => void conversationQuery.refetch()}
      />
    );
  }

  return (
    <CompanionChatAppInner
      key={conversationQuery.data.conversationId}
      profile={profile}
      serverConversation={conversationQuery.data}
      session={session}
    />
  );
}

function CompanionChatAppInner({
  profile,
  serverConversation,
  session,
}: CompanionChatAppProps & {
  serverConversation: CompanionConversationResponse;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AppMode>("chat");
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("profile");
  const [draft, setDraft] = useState("");
  const transport = useMemo(
    () =>
      new TextStreamChatTransport<UIMessage>({
        api: `${getWebClientEnv().NEXT_PUBLIC_API_BASE_URL}/rpc/chat/companion`,
        fetch: fetchWithClientSession,
        prepareSendMessagesRequest({ api, body, messages }) {
          return {
            api,
            body: {
              ...body,
              conversationId: serverConversation.conversationId,
              messages: messages.slice(-20),
            },
          };
        },
      }),
    [serverConversation.conversationId],
  );
  const {
    clearError,
    error,
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
  } = useChat({
    id: serverConversation.conversationId,
    messages: serverConversation.messages.map(toUiMessage),
    onFinish({ isAbort, isDisconnect, isError }) {
      if (!isAbort && !isDisconnect && !isError) {
        void queryClient.invalidateQueries({
          queryKey: companionChatKeys.conversation(),
        });
      }
    },
    transport,
  });
  const isSending = status === "submitted" || status === "streaming";
  const [nextCursor, setNextCursor] = useState(serverConversation.nextCursor);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState(false);
  const [historicalAssistantMessageIds, setHistoricalAssistantMessageIds] =
    useState<string[]>(() =>
      serverConversation.messages
        .filter((message) => message.role === "assistant")
        .map((message) => message.id),
    );

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

  async function loadMoreHistory() {
    if (!nextCursor || isLoadingMoreHistory) {
      return;
    }

    setHistoryLoadError(false);
    setIsLoadingMoreHistory(true);

    try {
      const result = await getCompanionConversationMessages(nextCursor);
      const olderMessages = result.messages.map(toUiMessage);
      const olderAssistantIds = result.messages
        .filter((message) => message.role === "assistant")
        .map((message) => message.id);

      setHistoricalAssistantMessageIds((current) => [
        ...new Set([...olderAssistantIds, ...current]),
      ]);
      setMessages((current) => {
        const currentIds = new Set(current.map((message) => message.id));
        return [
          ...olderMessages.filter((message) => !currentIds.has(message.id)),
          ...current,
        ];
      });
      setNextCursor(result.nextCursor);
    } catch {
      setHistoryLoadError(true);
    } finally {
      setIsLoadingMoreHistory(false);
    }
  }

  const lastMessage = messages.at(-1);
  const lastMessageText =
    lastMessage?.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("")
      .trim() ?? "";
  const conversationPreview = lastMessageText || AGENT_SUBTITLE;

  // 移动端：聊天模式默认展示会话列表，进入会话后隐藏列表；设置模式同理展示菜单。
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  return (
    <main className="h-svh overflow-hidden bg-background text-foreground lg:grid lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside
        className={`min-h-0 flex-col border-r border-border bg-surface lg:flex ${
          mobileDetailOpen ? "hidden lg:flex" : "flex"
        }`}
      >
        <div className="flex min-h-16 items-center gap-2 px-4">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            {mode === "chat" ? (
              <MessageCircle aria-hidden="true" className="size-4" />
            ) : (
              <Settings2 aria-hidden="true" className="size-4" />
            )}
          </span>
          <span className="text-lg font-semibold">
            {mode === "chat" ? AGENT_NAME : "设置"}
          </span>
        </div>

        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 rounded-full bg-surface-muted px-3.5 py-2 text-sm text-muted">
            <Search aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">搜索</span>
          </div>
        </div>

        {mode === "chat" ? (
          <nav
            aria-label="会话列表"
            className="min-h-0 flex-1 overflow-y-auto px-2"
          >
            <ConversationItem
              active
              name={AGENT_NAME}
              onClick={() => setMobileDetailOpen(true)}
              preview={conversationPreview}
            />
          </nav>
        ) : (
          <nav
            aria-label="设置菜单"
            className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2"
          >
            {settingsMenu.map((entry) => (
              <SettingsMenuItem
                active={settingsSection === entry.section}
                icon={entry.icon}
                key={entry.section}
                label={entry.label}
                onClick={() => {
                  setSettingsSection(entry.section);
                  setMobileDetailOpen(true);
                }}
              />
            ))}
          </nav>
        )}

        <div className="flex items-center gap-1 border-t border-border px-3 py-2.5">
          <SidebarModeButton
            active={mode === "chat"}
            icon={MessageCircle}
            label="聊天"
            onClick={() => {
              setMode("chat");
              setMobileDetailOpen(false);
            }}
          />
          <SidebarModeButton
            active={mode === "settings"}
            icon={Settings2}
            label="设置"
            onClick={() => {
              setMode("settings");
              setMobileDetailOpen(false);
            }}
          />
        </div>
      </aside>

      <div
        className={`h-svh min-h-0 flex-col lg:flex ${
          mobileDetailOpen ? "flex" : "hidden lg:flex"
        }`}
      >
        {mode === "chat" ? (
          <ChatMode
            clearError={clearError}
            draft={draft}
            error={error}
            isSending={isSending}
            messageCount={serverConversation.messageCount}
            historicalAssistantMessageIds={historicalAssistantMessageIds}
            historyLoadError={historyLoadError}
            isLoadingMoreHistory={isLoadingMoreHistory}
            messages={messages}
            onBack={() => setMobileDetailOpen(false)}
            onDraftChange={setDraft}
            onLoadMoreHistory={() => void loadMoreHistory()}
            onSend={handleSend}
            onStop={() => void stop()}
            status={status}
            hasMoreHistory={nextCursor !== null}
          />
        ) : (
          <SettingsMode
            onBack={() => setMobileDetailOpen(false)}
            onLogout={handleLogout}
            profile={profile}
            section={settingsSection}
            session={session}
            title={settingsTitle[settingsSection]}
          />
        )}
      </div>
    </main>
  );
}

function ChatMode({
  clearError,
  draft,
  error,
  hasMoreHistory,
  historicalAssistantMessageIds,
  historyLoadError,
  isSending,
  isLoadingMoreHistory,
  messageCount,
  messages,
  onBack,
  onDraftChange,
  onLoadMoreHistory,
  onSend,
  onStop,
  status,
}: {
  clearError: () => void;
  draft: string;
  error: Error | undefined;
  hasMoreHistory: boolean;
  historicalAssistantMessageIds: readonly string[];
  historyLoadError: boolean;
  isSending: boolean;
  isLoadingMoreHistory: boolean;
  messageCount: number;
  messages: UIMessage[];
  onBack: () => void;
  onDraftChange: (value: string) => void;
  onLoadMoreHistory: () => void;
  onSend: () => void;
  onStop: () => void;
  status: ReturnType<typeof useChat>["status"];
}) {
  return (
    <>
      <DetailHeader
        onBack={onBack}
        subtitle={getRelationshipStageLabel(messageCount)}
        title={AGENT_NAME}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-subtle text-primary-strong">
          <Bot aria-hidden="true" className="size-4" />
        </span>
      </DetailHeader>

      <section className="flex min-h-0 flex-1 flex-col">
        {hasMoreHistory || historyLoadError ? (
          <div className="flex min-h-11 shrink-0 items-center justify-center border-b border-border px-4 py-2">
            {historyLoadError ? (
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-danger">
                <span>更早的消息加载失败</span>
                <Button
                  onClick={onLoadMoreHistory}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  重试
                </Button>
              </div>
            ) : (
              <Button
                disabled={isLoadingMoreHistory}
                onClick={onLoadMoreHistory}
                size="sm"
                type="button"
                variant="ghost"
              >
                {isLoadingMoreHistory ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                ) : (
                  <History aria-hidden="true" className="size-4" />
                )}
                {isLoadingMoreHistory ? "正在加载" : "加载更早消息"}
              </Button>
            )}
          </div>
        ) : null}

        <ChatConversation
          historicalAssistantMessageIds={historicalAssistantMessageIds}
          messages={messages}
          status={status}
        />

        {error ? (
          <div
            className="mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm sm:mx-6"
            role="alert"
          >
            <p className="min-w-0 flex-1">回复生成失败，请稍后重试。</p>
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
          onChange={onDraftChange}
          onStop={onStop}
          onSubmit={onSend}
          value={draft}
        />
      </section>
    </>
  );
}

function SettingsMode({
  onBack,
  onLogout,
  profile,
  section,
  session,
  title,
}: {
  onBack: () => void;
  onLogout: () => void;
  profile: WebUserProfile;
  section: SettingsSection;
  session: WebSession;
  title: string;
}) {
  return (
    <>
      <DetailHeader onBack={onBack} title={title} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {section === "profile" ? (
          <ProfilePanel
            onLogout={onLogout}
            profile={profile}
            session={session}
          />
        ) : null}
        {section === "general" ? <GeneralPanel /> : null}
        {section === "memory" ? <MemoryPanel /> : null}
        {section === "appearance" ? <AppearancePanel /> : null}
      </div>
    </>
  );
}

function toUiMessage(
  message: CompanionConversationResponse["messages"][number],
): UIMessage {
  return {
    id: message.id,
    parts: [{ text: message.content, type: "text" }],
    role: message.role,
  };
}

function ConversationLoadingState() {
  return (
    <main
      aria-busy="true"
      className="grid min-h-svh place-items-center bg-background px-5 text-foreground"
    >
      <div className="flex items-center gap-3 text-sm text-muted" role="status">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        正在加载聊天记录
      </div>
    </main>
  );
}

function ConversationErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-5 text-foreground">
      <section className="w-full max-w-sm text-center">
        <h1 className="text-base font-semibold">聊天记录加载失败</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          请确认 API 已运行，并已应用最新 D1 迁移。
        </p>
        <Button className="mt-5 min-h-11" onClick={onRetry} type="button">
          重新加载
        </Button>
      </section>
    </main>
  );
}

function DetailHeader({
  children,
  onBack,
  subtitle,
  title,
}: {
  children?: React.ReactNode;
  onBack: () => void;
  subtitle?: string;
  title: string;
}) {
  return (
    <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
      <button
        aria-label="返回"
        className="grid size-9 shrink-0 place-items-center rounded-md text-muted outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus lg:hidden"
        onClick={onBack}
        title="返回"
        type="button"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </button>
      {children}
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold">{title}</h1>
        {subtitle ? (
          <p className="truncate text-xs text-muted">{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
}

function ConversationItem({
  active,
  name,
  onClick,
  preview,
}: {
  active: boolean;
  name: string;
  onClick: () => void;
  preview: string;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus ${
        active ? "bg-primary text-primary-foreground" : "hover:bg-surface-muted"
      }`}
      onClick={onClick}
      type="button"
    >
      <span
        className={`grid size-12 shrink-0 place-items-center rounded-full ${
          active
            ? "bg-primary-foreground/15 text-primary-foreground"
            : "bg-primary-subtle text-primary-strong"
        }`}
      >
        <Bot aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span
          className={`mt-0.5 line-clamp-2 text-xs leading-snug ${
            active ? "text-primary-foreground/80" : "text-muted"
          }`}
        >
          {preview}
        </span>
      </span>
    </button>
  );
}

function SettingsMenuItem({
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
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-surface-muted"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function SidebarModeButton({
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
      aria-label={label}
      className={`grid size-10 place-items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus ${
        active
          ? "bg-primary-subtle text-primary-strong"
          : "text-muted hover:bg-surface-muted hover:text-foreground"
      }`}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" className="size-5" />
    </button>
  );
}
