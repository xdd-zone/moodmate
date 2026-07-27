"use client";

import type {
  AgentGroupChatDetail,
  AgentGroupChatListItem,
  AgentGroupChatMember,
  AgentGroupChatMessage,
  UserAgent,
} from "@repo/contracts";
import { Button } from "@repo/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bot,
  LoaderCircle,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { MentionTextarea } from "@/src/components/group-chat/mention-textarea";

import { userAgentsQueryOptions } from "@/src/api/agent.query";
import { getGroupChatMessages } from "@/src/api/group-chat.api";
import {
  addGroupChatMembersMutationOptions,
  createGroupChatMutationOptions,
  groupChatDetailQueryOptions,
  groupChatKeys,
  groupChatsQueryOptions,
  removeGroupChatMemberMutationOptions,
  sendGroupChatMessageMutationOptions,
} from "@/src/api/group-chat.query";

const MAX_MEMBERS = 6;

export function GroupChatWorkspace() {
  const listQuery = useQuery(groupChatsQueryOptions());
  const [selectedId, setSelectedId] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const groupChats = useMemo(
    () => listQuery.data?.items ?? [],
    [listQuery.data],
  );

  useEffect(() => {
    if (selectedId.length > 0) {
      const stillExists = groupChats.some((chat) => chat.id === selectedId);

      if (stillExists) {
        return;
      }
    }

    setSelectedId(groupChats[0]?.id ?? "");
  }, [groupChats, selectedId]);

  return (
    <main className="mx-auto flex h-svh w-full max-w-6xl flex-col px-4 py-6 text-foreground sm:px-6">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <Link
            className="inline-flex items-center gap-1.5 text-sm text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
            href="/app"
          >
            <ArrowLeft aria-hidden className="size-4" />
            返回聊天
          </Link>
          <h1 className="mt-2 text-xl font-semibold">Agent 群聊</h1>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} type="button">
          <Plus aria-hidden className="size-4" />
          新建群聊
        </Button>
      </div>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[240px_minmax(0,1fr)_260px]">
        <GroupChatListColumn
          groupChats={groupChats}
          isError={listQuery.isError}
          isPending={listQuery.isPending}
          onSelectAction={setSelectedId}
          selectedId={selectedId}
        />

        <GroupChatDetailColumns groupChatId={selectedId} key={selectedId} />
      </div>

      {isCreateOpen ? (
        <CreateGroupChatDialog
          onCloseAction={() => setIsCreateOpen(false)}
          onCreatedAction={(id) => {
            setSelectedId(id);
            setIsCreateOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}

function GroupChatListColumn({
  groupChats,
  isError,
  isPending,
  onSelectAction,
  selectedId,
}: {
  groupChats: AgentGroupChatListItem[];
  isError: boolean;
  isPending: boolean;
  onSelectAction: (id: string) => void;
  selectedId: string;
}) {
  return (
    <aside className="flex min-h-0 flex-col rounded-md border border-border bg-surface">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold">
        群聊列表
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isPending ? (
          <p className="px-2 py-6 text-center text-sm text-muted" role="status">
            正在加载群聊
          </p>
        ) : isError ? (
          <p className="px-2 py-6 text-center text-sm text-danger" role="alert">
            加载失败，请刷新重试
          </p>
        ) : groupChats.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted">
            还没有群聊，点右上角新建。
          </p>
        ) : (
          <ul className="grid gap-1">
            {groupChats.map((chat) => (
              <li key={chat.id}>
                <button
                  className={`w-full rounded-md px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${
                    chat.id === selectedId
                      ? "bg-primary/12 text-foreground"
                      : "text-muted hover:bg-surface-muted hover:text-foreground"
                  }`}
                  onClick={() => onSelectAction(chat.id)}
                  type="button"
                >
                  <span className="block truncate text-sm font-medium">
                    {chat.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {chat.memberCount} 位成员 · {chat.messageCount} 条消息
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function GroupChatDetailColumns({ groupChatId }: { groupChatId: string }) {
  const detailQuery = useQuery(groupChatDetailQueryOptions(groupChatId));

  if (groupChatId.length === 0) {
    return (
      <>
        <section className="grid min-h-0 place-items-center rounded-md border border-border bg-surface">
          <p className="text-sm text-muted">选择或新建一个群聊开始</p>
        </section>
        <aside className="hidden rounded-md border border-border bg-surface md:block" />
      </>
    );
  }

  if (detailQuery.isPending) {
    return (
      <>
        <section className="grid min-h-0 place-items-center rounded-md border border-border bg-surface">
          <p className="text-sm text-muted" role="status">
            正在加载群聊详情
          </p>
        </section>
        <aside className="hidden rounded-md border border-border bg-surface md:block" />
      </>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <>
        <section className="grid min-h-0 place-items-center rounded-md border border-border bg-surface">
          <p className="text-sm text-danger" role="alert">
            群聊详情加载失败
          </p>
        </section>
        <aside className="hidden rounded-md border border-border bg-surface md:block" />
      </>
    );
  }

  return (
    <>
      <MessageColumn detail={detailQuery.data} groupChatId={groupChatId} />
      <MemberColumn detail={detailQuery.data} groupChatId={groupChatId} />
    </>
  );
}

const RECENT_MESSAGES_LIMIT = 50;

function MessageColumn({
  detail,
  groupChatId,
}: {
  detail: AgentGroupChatDetail;
  groupChatId: string;
}) {
  const queryClient = useQueryClient();
  const sendMutation = useMutation(
    sendGroupChatMessageMutationOptions(queryClient),
  );
  const [draft, setDraft] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(() =>
    detail.recentMessages.length >= RECENT_MESSAGES_LIMIT
      ? (detail.recentMessages[0]?.createdAtMs ?? null)
      : null,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [detail.recentMessages.length]);

  const canSend = draft.trim().length > 0 && !sendMutation.isPending;

  function handleSend() {
    const message = draft.trim();

    if (message.length === 0 || sendMutation.isPending) {
      return;
    }

    setDraft("");
    sendMutation.mutate(
      { groupChatId, message },
      {
        onError: () => setDraft(message),
      },
    );
  }

  const activeMembers = detail.members.filter(
    (member) => member.status === "active",
  );

  async function handleLoadEarlier() {
    if (nextCursor === null || isLoadingEarlier) {
      return;
    }

    setIsLoadingEarlier(true);
    setLoadError(null);

    try {
      const result = await getGroupChatMessages(groupChatId, nextCursor);
      const detailKey = groupChatKeys.detail(groupChatId);

      queryClient.setQueryData<AgentGroupChatDetail>(detailKey, (current) => {
        if (!current) {
          return current;
        }

        const existingIds = new Set(
          current.recentMessages.map((message) => message.id),
        );
        const earlier = result.items.filter(
          (message) => !existingIds.has(message.id),
        );

        return {
          ...current,
          recentMessages: [...earlier, ...current.recentMessages].sort(
            (a, b) => a.createdAtMs - b.createdAtMs,
          ),
        };
      });

      setNextCursor(result.nextCursor);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "加载失败，请重试");
    } finally {
      setIsLoadingEarlier(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-col rounded-md border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <p className="truncate text-sm font-semibold">
          {detail.groupChat.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {detail.members.length} 位成员在群里
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {nextCursor !== null ? (
          <div className="grid place-items-center">
            <button
              className="rounded-md px-3 py-1.5 text-xs text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60"
              disabled={isLoadingEarlier}
              onClick={handleLoadEarlier}
              type="button"
            >
              {isLoadingEarlier ? "正在加载" : "加载更早消息"}
            </button>
          </div>
        ) : null}

        {loadError ? (
          <p className="text-center text-xs text-danger" role="alert">
            {loadError}
          </p>
        ) : null}

        {detail.recentMessages.length === 0 ? (
          <div className="grid flex-1 place-items-center">
            <p className="flex flex-col items-center gap-2 text-sm text-muted">
              <MessageSquare aria-hidden className="size-6" />
              还没有消息
            </p>
          </div>
        ) : (
          detail.recentMessages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-end gap-2">
          <MentionTextarea
            disabled={sendMutation.isPending}
            members={activeMembers}
            onChange={setDraft}
            onSend={handleSend}
            value={draft}
          />
          <Button
            disabled={!canSend}
            onClick={handleSend}
            size="icon"
            type="button"
          >
            {sendMutation.isPending ? (
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
            ) : (
              <Send aria-hidden className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}

function MessageBubble({ message }: { message: AgentGroupChatMessage }) {
  if (message.senderType === "system") {
    return (
      <p className="mx-auto text-center text-xs text-muted">
        {message.content}
      </p>
    );
  }

  const isUser = message.senderType === "user";
  const isFailed = message.status === "failed";

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"
      >
        <Bot className="size-4" />
      </span>
      <div className={`min-w-0 max-w-[75%] ${isUser ? "text-right" : ""}`}>
        <p className="text-xs text-muted">
          {isUser ? "我" : (message.agentName ?? "Agent")}
          {isFailed ? <span className="ml-1 text-danger">发送失败</span> : null}
        </p>
        <div
          className={`mt-1 inline-block whitespace-pre-wrap break-words rounded-md border px-3 py-2 text-left text-sm ${
            isFailed
              ? "border-danger/50 bg-danger/8 text-danger"
              : "border-border bg-background"
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

function MemberColumn({
  detail,
  groupChatId,
}: {
  detail: AgentGroupChatDetail;
  groupChatId: string;
}) {
  const queryClient = useQueryClient();
  const removeMutation = useMutation(
    removeGroupChatMemberMutationOptions(queryClient),
  );
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  async function handleRemove(member: AgentGroupChatMember) {
    const confirmed = window.confirm(`确认移除成员「${member.name}」？`);

    if (!confirmed) {
      return;
    }

    await removeMutation.mutateAsync({ groupChatId, memberId: member.id });
  }

  const activeMembers = detail.members.filter(
    (member) => member.status === "active",
  );

  return (
    <aside className="flex min-h-0 flex-col rounded-md border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Users aria-hidden className="size-4" />
          成员
        </span>
        <Button
          disabled={activeMembers.length >= MAX_MEMBERS}
          onClick={() => setIsInviteOpen(true)}
          size="sm"
          type="button"
          variant="secondary"
        >
          <UserPlus aria-hidden className="size-4" />
          邀请
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="grid gap-1">
          {activeMembers.map((member) => (
            <li
              className="flex items-center gap-2 rounded-md px-2 py-2"
              key={member.id}
            >
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"
              >
                <Bot className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.name}</p>
                {member.headline ? (
                  <p className="truncate text-xs text-muted">
                    {member.headline}
                  </p>
                ) : null}
              </div>
              <Button
                aria-label={`移除 ${member.name}`}
                disabled={removeMutation.isPending}
                onClick={() => handleRemove(member)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </div>

      {isInviteOpen ? (
        <InviteMembersDialog
          existingAgentIds={activeMembers.map((member) => member.agentId)}
          groupChatId={groupChatId}
          onCloseAction={() => setIsInviteOpen(false)}
          remainingSlots={MAX_MEMBERS - activeMembers.length}
        />
      ) : null}
    </aside>
  );
}

function InviteMembersDialog({
  existingAgentIds,
  groupChatId,
  onCloseAction,
  remainingSlots,
}: {
  existingAgentIds: string[];
  groupChatId: string;
  onCloseAction: () => void;
  remainingSlots: number;
}) {
  const queryClient = useQueryClient();
  const agentsQuery = useQuery(userAgentsQueryOptions());
  const addMutation = useMutation(
    addGroupChatMembersMutationOptions(queryClient),
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const existingSet = useMemo(
    () => new Set(existingAgentIds),
    [existingAgentIds],
  );

  const candidates = (agentsQuery.data?.items ?? []).filter(
    (agent) => !existingSet.has(agent.id),
  );

  function toggle(agentId: string) {
    setSelected((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId],
    );
  }

  async function handleSubmit() {
    if (selected.length === 0) {
      setError("请至少选择一个 Agent");
      return;
    }

    if (selected.length > remainingSlots) {
      setError(`最多还能邀请 ${remainingSlots} 位成员`);
      return;
    }

    try {
      await addMutation.mutateAsync({
        groupChatId,
        payload: { agentIds: selected },
      });
      onCloseAction();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "邀请失败，请重试",
      );
    }
  }

  return (
    <DialogShell onCloseAction={onCloseAction} title="邀请 Agent">
      {agentsQuery.isPending ? (
        <p className="py-6 text-center text-sm text-muted" role="status">
          正在加载 Agent
        </p>
      ) : candidates.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          没有可邀请的 Agent。
        </p>
      ) : (
        <ul className="grid max-h-[50svh] gap-1 overflow-y-auto">
          {candidates.map((agent) => (
            <AgentPickerItem
              agent={agent}
              key={agent.id}
              onToggleAction={toggle}
              selected={selected.includes(agent.id)}
            />
          ))}
        </ul>
      )}

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-muted">
        已选 {selected.length} 位，还能邀请 {remainingSlots} 位
      </p>

      <DialogFooter
        isSaving={addMutation.isPending}
        onCancelAction={onCloseAction}
        onSubmitAction={handleSubmit}
        submitLabel="邀请"
      />
    </DialogShell>
  );
}

function CreateGroupChatDialog({
  onCloseAction,
  onCreatedAction,
}: {
  onCloseAction: () => void;
  onCreatedAction: (groupChatId: string) => void;
}) {
  const queryClient = useQueryClient();
  const agentsQuery = useQuery(userAgentsQueryOptions());
  const createMutation = useMutation(
    createGroupChatMutationOptions(queryClient),
  );
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const agents = agentsQuery.data?.items ?? [];

  function toggle(agentId: string) {
    setSelected((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId],
    );
  }

  async function handleSubmit() {
    if (title.trim().length === 0) {
      setError("请填写群聊标题");
      return;
    }

    if (selected.length === 0) {
      setError("请至少选择一个 Agent");
      return;
    }

    if (selected.length > MAX_MEMBERS) {
      setError(`最多选择 ${MAX_MEMBERS} 个 Agent`);
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        agentIds: selected,
        title: title.trim(),
      });
      onCreatedAction(result.groupChat.id);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "创建失败，请重试",
      );
    }
  }

  return (
    <DialogShell onCloseAction={onCloseAction} title="新建群聊">
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">群聊标题</span>
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="给群聊起个名字"
          value={title}
        />
      </label>

      <div className="grid gap-1.5">
        <span className="text-sm font-medium">
          选择 Agent（1-{MAX_MEMBERS} 个）
        </span>
        {agentsQuery.isPending ? (
          <p className="py-6 text-center text-sm text-muted" role="status">
            正在加载 Agent
          </p>
        ) : agents.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            还没有 Agent，请先到「我的 Agent」创建。
          </p>
        ) : (
          <ul className="grid max-h-[40svh] gap-1 overflow-y-auto">
            {agents.map((agent) => (
              <AgentPickerItem
                agent={agent}
                key={agent.id}
                onToggleAction={toggle}
                selected={selected.includes(agent.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-muted">已选 {selected.length} 个</p>

      <DialogFooter
        isSaving={createMutation.isPending}
        onCancelAction={onCloseAction}
        onSubmitAction={handleSubmit}
        submitLabel="创建"
      />
    </DialogShell>
  );
}

function AgentPickerItem({
  agent,
  onToggleAction,
  selected,
}: {
  agent: UserAgent;
  onToggleAction: (agentId: string) => void;
  selected: boolean;
}) {
  return (
    <li>
      <button
        aria-pressed={selected}
        className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${
          selected
            ? "border-primary bg-primary/12"
            : "border-border hover:bg-surface-muted"
        }`}
        onClick={() => onToggleAction(agent.id)}
        type="button"
      >
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"
        >
          <Bot className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {agent.name}
          </span>
          {agent.headline ? (
            <span className="block truncate text-xs text-muted">
              {agent.headline}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

function DialogShell({
  children,
  onCloseAction,
  title,
}: {
  children: React.ReactNode;
  onCloseAction: () => void;
  title: string;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseAction();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCloseAction]);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/40 p-4"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-md border border-border bg-surface shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <Button
            aria-label="关闭"
            onClick={onCloseAction}
            ref={closeButtonRef}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="grid max-h-[75svh] gap-4 overflow-y-auto px-5 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function DialogFooter({
  isSaving,
  onCancelAction,
  onSubmitAction,
  submitLabel,
}: {
  isSaving: boolean;
  onCancelAction: () => void;
  onSubmitAction: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
      <Button onClick={onCancelAction} type="button" variant="secondary">
        取消
      </Button>
      <Button disabled={isSaving} onClick={onSubmitAction} type="button">
        {isSaving ? (
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
        ) : null}
        {submitLabel}
      </Button>
    </div>
  );
}
