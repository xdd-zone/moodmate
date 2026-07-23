"use client";

import type {
  CompanionMemory,
  UpdateCompanionMemoryRequest,
  WebSession,
  WebUserProfile,
} from "@repo/contracts";
import { Button } from "@repo/ui/button";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, LoaderCircle, LogOut, Power, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  deleteCompanionMemory,
  updateCompanionMemory,
} from "@/src/api/chat.api";
import {
  companionChatKeys,
  companionMemoriesQueryOptions,
} from "@/src/api/chat.query";
import { clearLocalLlmConfig } from "@/src/auth/local-llm-config";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function PanelShell({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-7 sm:px-6 sm:py-10">
      <div className="border-b border-border pb-5">
        <h2 className="text-xl font-semibold">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="break-words sm:text-right">{value}</dd>
    </div>
  );
}

export function ProfilePanel({
  onLogout,
  profile,
  session,
}: {
  onLogout: () => void;
  profile: WebUserProfile;
  session: WebSession;
}) {
  return (
    <PanelShell description="当前登录信息" title="个人资料">
      <dl className="divide-y divide-border py-3 text-sm">
        <InfoRow label="昵称" value={profile.displayName} />
        <InfoRow label="邮箱" value={profile.email} />
        <InfoRow label="身份" value={profile.roles.join("、")} />
        <InfoRow
          label="会话有效期"
          value={dateTimeFormatter.format(new Date(session.expiresAtMs))}
        />
      </dl>
      <Button
        className="mt-5 min-h-11"
        onClick={onLogout}
        type="button"
        variant="danger"
      >
        <LogOut aria-hidden="true" className="size-4" />
        退出登录
      </Button>
    </PanelShell>
  );
}

export function GeneralPanel() {
  return (
    <PanelShell description="通用偏好设置。更多选项陆续开放。" title="General">
      <p className="py-6 text-sm leading-6 text-muted">
        暂无可调整的通用选项。
      </p>
    </PanelShell>
  );
}

export function AppearancePanel() {
  return (
    <PanelShell description="调整界面主题外观。" title="Appearance">
      <div className="flex items-center justify-between gap-4 border-b border-border py-5">
        <div className="min-w-0">
          <p className="text-sm font-medium">主题</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            在浅色和深色之间切换。
          </p>
        </div>
        <ThemeToggle />
      </div>
    </PanelShell>
  );
}

export function DataPanel() {
  const [notice, setNotice] = useState("");

  function handleClear() {
    clearLocalLlmConfig();
    setNotice("本地 LLM 配置和 API Key 已删除。");
  }

  return (
    <PanelShell description="管理保存在本浏览器的数据。" title="数据管理">
      <div className="grid gap-4 py-6">
        <div className="rounded-md border border-border bg-surface px-4 py-4">
          <p className="text-sm font-medium">本地 LLM 配置</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            清除保存在当前浏览器的 Provider、Base URL、Model 和 API Key。
          </p>
          <Button
            className="mt-4 min-h-11"
            onClick={handleClear}
            type="button"
            variant="danger"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            删除本地配置
          </Button>
        </div>
      </div>
      {notice ? (
        <p className="text-sm text-muted" role="status">
          {notice}
        </p>
      ) : null}
    </PanelShell>
  );
}

export function MemoryPanel() {
  const queryClient = useQueryClient();
  const memoriesQuery = useQuery(companionMemoriesQueryOptions());
  const updateMutation = useMutation({
    mutationFn: (input: {
      memoryId: string;
      patch: UpdateCompanionMemoryRequest;
    }) => updateCompanionMemory(input.memoryId, input.patch),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: companionChatKeys.memories(),
      }),
  });
  const deleteMutation = useMutation({
    mutationFn: (memoryId: string) => deleteCompanionMemory(memoryId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: companionChatKeys.memories(),
      }),
  });

  return (
    <PanelShell description="当前账号保存的偏好、边界和关系目标。" title="记忆">
      {memoriesQuery.isPending ? (
        <div
          className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted"
          role="status"
        >
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          正在加载记忆
        </div>
      ) : null}

      {memoriesQuery.isError ? (
        <div className="py-6 text-sm" role="alert">
          <p className="text-danger">记忆加载失败，请检查 API 和 D1 迁移。</p>
          <Button
            className="mt-4"
            onClick={() => void memoriesQuery.refetch()}
            type="button"
            variant="outline"
          >
            重新加载
          </Button>
        </div>
      ) : null}

      {memoriesQuery.data?.items.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center py-8 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-primary-subtle text-primary-strong">
            <Brain aria-hidden="true" className="size-5" />
          </span>
          <p className="mt-3 text-sm font-medium">还没有长期记忆</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-muted">
            对话中明确表达的偏好、习惯或边界会出现在这里。
          </p>
        </div>
      ) : null}

      {memoriesQuery.data?.items.length ? (
        <div className="divide-y divide-border">
          {memoriesQuery.data.items.map((memory) => (
            <MemoryEditor
              deleteError={
                deleteMutation.isError && deleteMutation.variables === memory.id
              }
              isDeleting={
                deleteMutation.isPending &&
                deleteMutation.variables === memory.id
              }
              isUpdating={
                updateMutation.isPending &&
                updateMutation.variables.memoryId === memory.id
              }
              key={`${memory.id}:${memory.updatedAtMs}`}
              memory={memory}
              onDelete={() => deleteMutation.mutate(memory.id)}
              onUpdate={(patch) =>
                updateMutation.mutate({ memoryId: memory.id, patch })
              }
              updateError={
                updateMutation.isError &&
                updateMutation.variables.memoryId === memory.id
              }
            />
          ))}
        </div>
      ) : null}
    </PanelShell>
  );
}

function MemoryEditor({
  deleteError,
  isDeleting,
  isUpdating,
  memory,
  onDelete,
  onUpdate,
  updateError,
}: {
  deleteError: boolean;
  isDeleting: boolean;
  isUpdating: boolean;
  memory: CompanionMemory;
  onDelete: () => void;
  onUpdate: (patch: UpdateCompanionMemoryRequest) => void;
  updateError: boolean;
}) {
  const [type, setType] = useState(memory.type);
  const [content, setContent] = useState(memory.content);
  const [importance, setImportance] = useState(memory.importance);
  const isPending = isDeleting || isUpdating;

  function handleDelete() {
    if (window.confirm("删除这条记忆？删除后不会再用于聊天。")) {
      onDelete();
    }
  }

  return (
    <article className="py-6 first:pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span
            className={`size-2 rounded-full ${
              memory.status === "active" ? "bg-success" : "bg-muted"
            }`}
          />
          {memory.status === "active" ? "启用中" : "已停用"}
          <span>{dateTimeFormatter.format(new Date(memory.updatedAtMs))}</span>
        </div>
        <span className="text-xs text-muted">重要度 {importance}</span>
      </div>

      <div className="mt-4 grid gap-4">
        <label className="grid gap-1.5 text-sm font-medium">
          类型
          <input
            className="min-h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus"
            disabled={isPending}
            maxLength={80}
            onChange={(event) => setType(event.target.value)}
            value={type}
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium">
          内容
          <textarea
            className="min-h-24 resize-y rounded-md border border-border bg-background px-3 py-2.5 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-focus"
            disabled={isPending}
            maxLength={2000}
            onChange={(event) => setContent(event.target.value)}
            value={content}
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium sm:max-w-48">
          重要度
          <select
            className="min-h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus"
            disabled={isPending}
            onChange={(event) => setImportance(Number(event.target.value))}
            value={importance}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      {memory.sourceMessage ? (
        <div className="mt-4 border-l-2 border-border pl-3 text-xs leading-5 text-muted">
          <p>
            来源：
            {memory.sourceMessage.role === "user" ? "用户" : "MoodMate"}，
            {dateTimeFormatter.format(
              new Date(memory.sourceMessage.createdAtMs),
            )}
          </p>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap">
            {memory.sourceMessage.content}
          </p>
        </div>
      ) : null}

      {updateError || deleteError ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          {deleteError ? "记忆删除失败，请重试。" : "记忆保存失败，请重试。"}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          disabled={isPending || !type.trim() || !content.trim()}
          onClick={() =>
            onUpdate({
              content,
              importance,
              type,
            })
          }
          type="button"
        >
          {isUpdating ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Save aria-hidden="true" className="size-4" />
          )}
          保存
        </Button>
        <Button
          disabled={isPending}
          onClick={() =>
            onUpdate({
              status: memory.status === "active" ? "disabled" : "active",
            })
          }
          type="button"
          variant="outline"
        >
          <Power aria-hidden="true" className="size-4" />
          {memory.status === "active" ? "停用" : "启用"}
        </Button>
        <Button
          disabled={isPending}
          onClick={handleDelete}
          type="button"
          variant="danger"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          删除
        </Button>
      </div>
    </article>
  );
}
