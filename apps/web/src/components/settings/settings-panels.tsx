"use client";

import type {
  CompanionCareEvent,
  CompanionCareFrequency,
  CompanionCarePlan,
  CompanionCareScene,
  CompanionCareTone,
  CompanionMemory,
  UpdateCompanionMemoryRequest,
  UpsertCompanionCarePlanRequest,
  WebSession,
  WebUserProfile,
} from "@repo/contracts";
import { Button } from "@repo/ui/button";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  Heart,
  LoaderCircle,
  LogOut,
  Power,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import {
  deleteCompanionMemory,
  updateCompanionMemory,
} from "@/src/api/chat.api";
import {
  companionCareEventsQueryOptions,
  companionCarePlanQueryOptions,
  companionChatKeys,
  companionMemoriesQueryOptions,
  generateCompanionCareEventMutationOptions,
  updateCompanionCarePlanMutationOptions,
} from "@/src/api/chat.query";

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

const CARE_SCENE_OPTIONS: { label: string; value: CompanionCareScene }[] = [
  { label: "早安问候", value: "morning" },
  { label: "晚安陪伴", value: "night" },
  { label: "久未聊天", value: "long_absence" },
  { label: "压力陪伴", value: "stress_support" },
  { label: "关系升温", value: "relationship_warmup" },
  { label: "纪念时刻", value: "anniversary" },
];

const CARE_SCENE_LABELS: Record<CompanionCareScene, string> = {
  anniversary: "纪念时刻",
  long_absence: "久未聊天",
  morning: "早安问候",
  night: "晚安陪伴",
  relationship_warmup: "关系升温",
  stress_support: "压力陪伴",
};

const CARE_FREQUENCY_OPTIONS: {
  label: string;
  value: CompanionCareFrequency;
}[] = [
  { label: "每天", value: "daily" },
  { label: "每周", value: "weekly" },
  { label: "自定义", value: "custom" },
];

const CARE_TONE_OPTIONS: { label: string; value: CompanionCareTone }[] = [
  { label: "轻松", value: "light" },
  { label: "温柔", value: "gentle" },
  { label: "亲密", value: "intimate" },
];

const CARE_EVENT_STATUS_LABELS: Record<CompanionCareEvent["status"], string> = {
  generated: "未读",
  read: "已读",
};

export function CarePanel() {
  const queryClient = useQueryClient();
  const planQuery = useQuery(companionCarePlanQueryOptions());
  const eventsQuery = useQuery(companionCareEventsQueryOptions());
  const updateMutation = useMutation(
    updateCompanionCarePlanMutationOptions(queryClient),
  );
  const generateMutation = useMutation(
    generateCompanionCareEventMutationOptions(queryClient),
  );

  if (planQuery.isPending) {
    return (
      <PanelShell
        description="配置伴侣主动发起关怀的时机与语气。"
        title="主动关怀"
      >
        <div
          className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted"
          role="status"
        >
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          正在加载关怀计划
        </div>
      </PanelShell>
    );
  }

  if (planQuery.isError) {
    return (
      <PanelShell
        description="配置伴侣主动发起关怀的时机与语气。"
        title="主动关怀"
      >
        <div className="py-6 text-sm" role="alert">
          <p className="text-danger">
            关怀计划加载失败，请检查 API 和 D1 迁移。
          </p>
          <Button
            className="mt-4"
            onClick={() => void planQuery.refetch()}
            type="button"
            variant="outline"
          >
            重新加载
          </Button>
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell
      description="配置伴侣主动发起关怀的时机与语气，并可手动生成一条关怀消息。"
      title="主动关怀"
    >
      <CareForm
        isSaving={updateMutation.isPending}
        key={`${planQuery.data.plan.id}:${planQuery.data.plan.updatedAtMs}`}
        onSave={(payload) => updateMutation.mutate(payload)}
        plan={planQuery.data.plan}
        saveError={updateMutation.isError}
      />

      <div className="mt-8 border-t border-border pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">手动生成关怀</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              生成的关怀消息会作为伴侣消息写入聊天记录。
            </p>
          </div>
          <Button
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate({})}
            type="button"
          >
            {generateMutation.isPending ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : (
              <Sparkles aria-hidden="true" className="size-4" />
            )}
            生成关怀
          </Button>
        </div>

        {generateMutation.isError ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            关怀生成失败，请重试。
          </p>
        ) : null}
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <p className="text-sm font-medium">最近关怀记录</p>
        <CareEventList
          events={eventsQuery.data?.items ?? []}
          isError={eventsQuery.isError}
          isPending={eventsQuery.isPending}
          onRetry={() => void eventsQuery.refetch()}
        />
      </div>
    </PanelShell>
  );
}

function CareForm({
  isSaving,
  onSave,
  plan,
  saveError,
}: {
  isSaving: boolean;
  onSave: (payload: UpsertCompanionCarePlanRequest) => void;
  plan: CompanionCarePlan;
  saveError: boolean;
}) {
  const [enabled, setEnabled] = useState(plan.enabled);
  const [frequency, setFrequency] = useState<CompanionCareFrequency>(
    plan.frequency,
  );
  const [preferredTime, setPreferredTime] = useState(plan.preferredTime ?? "");
  const [scenes, setScenes] = useState<CompanionCareScene[]>(plan.scenes);
  const [tone, setTone] = useState<CompanionCareTone>(plan.tone);
  const [customPrompt, setCustomPrompt] = useState(plan.customPrompt ?? "");
  const noSceneSelected = scenes.length === 0;

  function toggleScene(scene: CompanionCareScene) {
    setScenes((current) =>
      current.includes(scene)
        ? current.filter((item) => item !== scene)
        : [...current, scene],
    );
  }

  function handleSave() {
    if (noSceneSelected) {
      return;
    }

    onSave({
      customPrompt: customPrompt.trim() || null,
      enabled,
      frequency,
      preferredTime: preferredTime.trim() || null,
      scenes,
      tone,
    });
  }

  return (
    <div className="grid gap-6 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">开启主动关怀</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            关闭后不会计算下一次关怀时间。
          </p>
        </div>
        <button
          aria-checked={enabled}
          aria-label="开启主动关怀"
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${
            enabled ? "bg-primary" : "bg-surface-muted"
          }`}
          onClick={() => setEnabled((value) => !value)}
          role="switch"
          type="button"
        >
          <span
            className={`inline-block size-5 rounded-full bg-background shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <label className="grid gap-1.5 text-sm font-medium sm:max-w-48">
        频率
        <select
          className="min-h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus"
          disabled={isSaving}
          onChange={(event) =>
            setFrequency(event.target.value as CompanionCareFrequency)
          }
          value={frequency}
        >
          {CARE_FREQUENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-medium sm:max-w-48">
        偏好时间
        <input
          className="min-h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus"
          disabled={isSaving}
          onChange={(event) => setPreferredTime(event.target.value)}
          type="time"
          value={preferredTime}
        />
      </label>

      <fieldset className="grid gap-2 text-sm font-medium">
        <legend className="mb-1">关怀场景</legend>
        <div className="flex flex-wrap gap-2">
          {CARE_SCENE_OPTIONS.map((option) => {
            const active = scenes.includes(option.value);
            return (
              <button
                aria-pressed={active}
                className={`min-h-9 rounded-full border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  active
                    ? "border-primary bg-primary-subtle text-primary-strong"
                    : "border-border text-muted hover:bg-surface-muted"
                }`}
                disabled={isSaving}
                key={option.value}
                onClick={() => toggleScene(option.value)}
                type="button"
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {noSceneSelected ? (
          <p className="text-xs text-danger">至少选择一个关怀场景。</p>
        ) : null}
      </fieldset>

      <label className="grid gap-1.5 text-sm font-medium sm:max-w-48">
        语气
        <select
          className="min-h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus"
          disabled={isSaving}
          onChange={(event) => setTone(event.target.value as CompanionCareTone)}
          value={tone}
        >
          {CARE_TONE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-medium">
        自定义关怀文案
        <textarea
          className="min-h-24 resize-y rounded-md border border-border bg-background px-3 py-2.5 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-focus"
          disabled={isSaving}
          maxLength={800}
          onChange={(event) => setCustomPrompt(event.target.value)}
          placeholder="留空则按场景使用默认文案。"
          value={customPrompt}
        />
      </label>

      {saveError ? (
        <p className="text-sm text-danger" role="alert">
          关怀计划保存失败，请重试。
        </p>
      ) : null}

      <div>
        <Button
          disabled={isSaving || noSceneSelected}
          onClick={handleSave}
          type="button"
        >
          {isSaving ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Save aria-hidden="true" className="size-4" />
          )}
          保存计划
        </Button>
      </div>
    </div>
  );
}

function CareEventList({
  events,
  isError,
  isPending,
  onRetry,
}: {
  events: CompanionCareEvent[];
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
}) {
  if (isPending) {
    return (
      <div
        className="flex min-h-20 items-center justify-center gap-2 text-sm text-muted"
        role="status"
      >
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        正在加载关怀记录
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-4 text-sm" role="alert">
        <p className="text-danger">关怀记录加载失败。</p>
        <Button
          className="mt-3"
          onClick={onRetry}
          type="button"
          variant="outline"
        >
          重新加载
        </Button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex min-h-24 flex-col items-center justify-center py-6 text-center">
        <span className="grid size-10 place-items-center rounded-full bg-primary-subtle text-primary-strong">
          <Heart aria-hidden="true" className="size-5" />
        </span>
        <p className="mt-3 text-sm font-medium">还没有关怀记录</p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted">
          点击上方生成关怀，记录会出现在这里。
        </p>
      </div>
    );
  }

  return (
    <ul className="mt-3 divide-y divide-border">
      {events.map((event) => (
        <li className="py-4" key={event.id}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span className="flex items-center gap-2">
              <span className="rounded-full bg-surface-muted px-2 py-0.5">
                {CARE_SCENE_LABELS[event.scene]}
              </span>
              <span>{CARE_EVENT_STATUS_LABELS[event.status]}</span>
            </span>
            <span>
              {dateTimeFormatter.format(new Date(event.generatedAtMs))}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {event.message}
          </p>
        </li>
      ))}
    </ul>
  );
}
