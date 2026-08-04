"use client";

import {
  AdminSystemAgentMutationRequestSchema,
  type AdminAgent,
  type AdminAgentDetailResponse,
  type AdminSystemAgentMutationRequest,
  type AdminSystemAgentUpdateRequest,
} from "@repo/contracts";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import type { FormEvent } from "react";

import {
  createAdminSystemAgent,
  deleteAdminSystemAgent,
  disableAdminSystemAgent,
  enableAdminSystemAgent,
  getAdminAgentDetail,
  updateAdminSystemAgent,
} from "@/src/api/operations.api";
import {
  adminAgentsQueryOptions,
  operationsKeys,
} from "@/src/api/operations.query";

const time = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  hour12: false,
});

const EMPTY_FORM: AdminSystemAgentMutationRequest = {
  name: "",
  headline: null,
  description: null,
  storyBackground: null,
  personaPrompt: null,
  tonePrompt: null,
  guardrailsPrompt: null,
  defaultPrompt: null,
  imageKey: null,
};

const STATUS_LABELS: Record<AdminAgent["status"], string> = {
  active: "启用",
  disabled: "已停用",
  archived: "已归档",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function toForm(agent: AdminAgent): AdminSystemAgentMutationRequest {
  return {
    defaultPrompt: agent.defaultPrompt,
    description: agent.description,
    guardrailsPrompt: agent.guardrailsPrompt,
    headline: agent.headline,
    imageKey: agent.imageKey,
    name: agent.name,
    personaPrompt: agent.personaPrompt,
    storyBackground: agent.storyBackground,
    tonePrompt: agent.tonePrompt,
  };
}

function AgentForm({
  form,
  onChange,
  onSubmit,
  pending,
  editing,
  onClose,
  error,
}: {
  form: AdminSystemAgentMutationRequest;
  onChange: (
    field: keyof AdminSystemAgentMutationRequest,
    value: string,
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  editing: boolean;
  onClose: () => void;
  error: string;
}) {
  return (
    <form
      className="flex min-h-full flex-col bg-background sm:min-h-0"
      onSubmit={onSubmit}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">
            {editing ? "编辑系统朋友" : "新建系统朋友"}
          </h2>
          <p className="mt-1 text-xs text-muted">
            配置只影响后续 AI 调用，历史会话仍保留原记录。
          </p>
        </div>
        <Button
          aria-label="关闭"
          onClick={onClose}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium">名称</span>
          <Input
            maxLength={120}
            onChange={(event) => onChange("name", event.currentTarget.value)}
            value={form.name}
          />
        </label>
        {(
          [
            ["headline", "一句话介绍", 200],
            ["description", "详细介绍", 2000],
            ["storyBackground", "背景故事", 4000],
            ["personaPrompt", "人设 Prompt", 4000],
            ["tonePrompt", "语气 Prompt", 2000],
            ["guardrailsPrompt", "边界 Prompt", 2000],
            ["defaultPrompt", "默认 Prompt", 4000],
            ["imageKey", "头像 key", 300],
          ] as const
        ).map(([field, label, maxLength]) => (
          <label
            className={
              field === "description" ||
              field === "storyBackground" ||
              field.includes("Prompt")
                ? "sm:col-span-2"
                : ""
            }
            key={field}
          >
            <span className="mb-1.5 block text-xs font-medium">{label}</span>
            {field.includes("Prompt") ||
            field === "description" ||
            field === "storyBackground" ? (
              <textarea
                className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus"
                maxLength={maxLength}
                onChange={(event) => onChange(field, event.currentTarget.value)}
                value={form[field] ?? ""}
              />
            ) : (
              <Input
                maxLength={maxLength}
                onChange={(event) => onChange(field, event.currentTarget.value)}
                value={form[field] ?? ""}
              />
            )}
          </label>
        ))}
      </div>
      {error ? (
        <p
          className="mx-5 mb-3 rounded-md border border-danger bg-surface px-3 py-2 text-xs text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-auto flex justify-end gap-2 border-t border-border px-5 py-4">
        <Button onClick={onClose} type="button" variant="secondary">
          取消
        </Button>
        <Button disabled={pending} type="submit">
          <Pencil className="size-3.5" />
          {pending ? "保存中" : "保存"}
        </Button>
      </div>
    </form>
  );
}

function AgentDetail({
  detail,
  onClose,
}: {
  detail: AdminAgentDetailResponse;
  onClose: () => void;
}) {
  const { agent, stats } = detail;
  const fields = [
    ["一句话介绍", agent.headline],
    ["详细介绍", agent.description],
    ["背景故事", agent.storyBackground],
    ["人设 Prompt", agent.personaPrompt],
    ["语气 Prompt", agent.tonePrompt],
    ["边界 Prompt", agent.guardrailsPrompt],
    ["默认 Prompt", agent.defaultPrompt],
  ] as const;

  return (
    <section className="flex min-h-full flex-col bg-background sm:min-h-0">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">{agent.name}</h2>
          <p className="mt-1 text-xs text-muted">
            {agent.source === "system" ? "系统朋友" : "用户朋友"} ·{" "}
            {STATUS_LABELS[agent.status]}
          </p>
        </div>
        <Button
          aria-label="关闭详情"
          onClick={onClose}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X className="size-4" />
        </Button>
      </header>
      <div className="overflow-y-auto p-5">
        <dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-sm sm:grid-cols-3">
          {[
            ["使用用户", stats.userCount],
            ["会话", stats.conversationCount],
            ["消息", stats.messageCount],
            ["记忆", stats.memoryCount],
            ["群聊", stats.groupCount],
            ["AI 调用", stats.aiCallCount],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <dl className="mt-6 space-y-5 border-t border-border pt-5">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium text-muted">{label}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm leading-6">
                {value || "未填写"}
              </dd>
            </div>
          ))}
        </dl>
        <dl className="mt-6 grid gap-4 border-t border-border pt-5 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted">创建时间</dt>
            <dd className="mt-1">{time.format(agent.createdAtMs)}</dd>
          </div>
          <div>
            <dt className="text-muted">更新时间</dt>
            <dd className="mt-1">{time.format(agent.updatedAtMs)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export function FriendsPage() {
  const pageSize = 20;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [source, setSource] = useState<"system" | "user" | undefined>();
  const [status, setStatus] = useState<AdminAgent["status"] | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<AdminAgentDetailResponse | null>(null);
  const [editing, setEditing] = useState<AdminAgent | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const agentsQuery = useQuery(
    adminAgentsQueryOptions({
      page,
      pageSize,
      source,
      status,
      ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
    }),
  );

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: operationsKeys.all });
  const createMutation = useMutation({
    mutationFn: createAdminSystemAgent,
    onSuccess: async () => {
      setDrawerOpen(false);
      await refresh();
    },
    onError: (error) =>
      setFormError(errorMessage(error, "创建朋友失败，请稍后重试")),
  });
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: AdminSystemAgentUpdateRequest;
    }) => updateAdminSystemAgent(id, payload),
    onSuccess: async () => {
      setDrawerOpen(false);
      await refresh();
    },
    onError: (error) =>
      setFormError(errorMessage(error, "保存朋友失败，请稍后重试")),
  });
  const disableMutation = useMutation({
    mutationFn: disableAdminSystemAgent,
    onSuccess: refresh,
    onError: (error) =>
      setFormError(errorMessage(error, "停用朋友失败，请稍后重试")),
  });
  const enableMutation = useMutation({
    mutationFn: enableAdminSystemAgent,
    onSuccess: refresh,
    onError: (error) =>
      setFormError(errorMessage(error, "启用朋友失败，请稍后重试")),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteAdminSystemAgent,
    onSuccess: refresh,
    onError: (error) =>
      setFormError(errorMessage(error, "删除朋友失败，请稍后重试")),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setDrawerOpen(true);
  }

  async function openEdit(agentId: string) {
    setDetailLoadingId(agentId);
    setFormError("");
    try {
      const result = await getAdminAgentDetail(agentId);
      setEditing(result.agent);
      setForm(toForm(result.agent));
      setDrawerOpen(true);
    } catch (error) {
      setFormError(errorMessage(error, "读取朋友配置失败，请稍后重试"));
    } finally {
      setDetailLoadingId(null);
    }
  }

  async function openDetail(agentId: string) {
    setDetailLoadingId(agentId);
    setFormError("");
    try {
      setDetail(await getAdminAgentDetail(agentId));
    } catch (error) {
      setFormError(errorMessage(error, "读取朋友详情失败，请稍后重试"));
    } finally {
      setDetailLoadingId(null);
    }
  }

  function handleChange(
    field: keyof AdminSystemAgentMutationRequest,
    value: string,
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = AdminSystemAgentMutationRequestSchema.safeParse(form);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "请检查表单内容");
      return;
    }
    setFormError("");
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: parsed.data });
    } else {
      createMutation.mutate(parsed.data);
    }
  }

  const agents = agentsQuery.data?.items ?? [];
  const totalPages = agentsQuery.data?.totalPages ?? 0;
  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <section className="w-full">
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">朋友管理</h1>
          <p className="mt-1 text-xs leading-6 text-muted sm:text-sm">
            系统朋友可维护，用户创建的朋友只读。
          </p>
        </div>
        <Button
          className="ml-auto"
          onClick={openCreate}
          size="sm"
          type="button"
        >
          <Plus className="size-3.5" />
          新建系统朋友
        </Button>
      </div>
      {formError && !drawerOpen ? (
        <p
          className="mb-4 rounded-md border border-danger bg-surface px-4 py-3 text-xs text-danger"
          role="alert"
        >
          {formError}
        </p>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          aria-label="搜索朋友"
          className="w-full sm:w-64"
          onChange={(event) => {
            setKeyword(event.currentTarget.value);
            setPage(1);
          }}
          placeholder="搜索名称、用户或邮箱"
          value={keyword}
        />
        <select
          aria-label="来源筛选"
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          onChange={(event) => {
            setSource(
              event.currentTarget.value === "all"
                ? undefined
                : (event.currentTarget.value as "system" | "user"),
            );
            setPage(1);
          }}
          value={source ?? "all"}
        >
          <option value="all">全部来源</option>
          <option value="system">系统朋友</option>
          <option value="user">用户朋友</option>
        </select>
        <select
          aria-label="状态筛选"
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          onChange={(event) => {
            setStatus(
              event.currentTarget.value === "all"
                ? undefined
                : (event.currentTarget.value as AdminAgent["status"]),
            );
            setPage(1);
          }}
          value={status ?? "all"}
        >
          <option value="all">全部状态</option>
          <option value="active">启用</option>
          <option value="disabled">已停用</option>
          <option value="archived">已归档</option>
        </select>
      </div>
      {agentsQuery.isError ? (
        <Card className="p-5 text-sm text-danger" role="alert">
          {errorMessage(agentsQuery.error, "朋友列表加载失败，请稍后重试")}
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table
            className="min-w-[116rem] table-fixed"
            containerClassName="admin-table-scroll admin-table-scroll-framed"
          >
            <TableHeader>
              <TableRow>
                <TableHead className="w-56">朋友</TableHead>
                <TableHead className="w-24">来源</TableHead>
                <TableHead className="w-48">所属用户</TableHead>
                <TableHead className="w-28">状态</TableHead>
                <TableHead className="w-28">使用用户</TableHead>
                <TableHead className="w-24">会话</TableHead>
                <TableHead className="w-24">消息</TableHead>
                <TableHead className="w-24">记忆</TableHead>
                <TableHead className="w-24">群聊</TableHead>
                <TableHead className="w-40">最近使用</TableHead>
                <TableHead className="w-40">创建时间</TableHead>
                <TableHead className="w-40">更新时间</TableHead>
                <TableHead className="w-40 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="py-10 text-center text-muted"
                    colSpan={13}
                  >
                    没有符合条件的朋友
                  </TableCell>
                </TableRow>
              ) : (
                agents.map((item) => {
                  const system = item.source === "system";
                  const unused =
                    item.conversationCount === 0 &&
                    item.messageCount === 0 &&
                    item.memoryCount === 0 &&
                    item.groupCount === 0;
                  const pending =
                    (disableMutation.isPending &&
                      disableMutation.variables === item.id) ||
                    (enableMutation.isPending &&
                      enableMutation.variables === item.id) ||
                    (deleteMutation.isPending &&
                      deleteMutation.variables === item.id);
                  return (
                    <TableRow key={item.id}>
                      <TableCell
                        className="truncate font-medium"
                        title={item.name}
                      >
                        {item.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline">
                          {system ? "系统" : "用户"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="truncate"
                        title={item.ownerDisplayName ?? "全局共享"}
                      >
                        {item.ownerDisplayName ?? "全局共享"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {STATUS_LABELS[item.status]}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {item.userCount}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {item.conversationCount}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {item.messageCount}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {item.memoryCount}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {item.groupCount}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {item.lastUsedAtMs
                          ? time.format(item.lastUsedAtMs)
                          : "尚未使用"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {time.format(item.createdAtMs)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {time.format(item.updatedAtMs)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            aria-label={`查看${item.name}详情`}
                            disabled={detailLoadingId === item.id}
                            onClick={() => void openDetail(item.id)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <Eye className="size-4" />
                          </Button>
                          {system ? (
                            <>
                              <Button
                                aria-label={`编辑${item.name}`}
                                disabled={detailLoadingId === item.id}
                                onClick={() => void openEdit(item.id)}
                                size="icon"
                                type="button"
                                variant="ghost"
                              >
                                <Pencil className="size-4" />
                              </Button>
                              {item.status === "active" ? (
                                <Button
                                  aria-label={`停用${item.name}`}
                                  disabled={pending}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `停用系统朋友“${item.name}”？已有会话仍可查看。`,
                                      )
                                    )
                                      disableMutation.mutate(item.id);
                                  }}
                                  size="icon"
                                  type="button"
                                  variant="ghost"
                                >
                                  <Ban className="size-4" />
                                </Button>
                              ) : (
                                <Button
                                  aria-label={`启用${item.name}`}
                                  disabled={pending}
                                  onClick={() => enableMutation.mutate(item.id)}
                                  size="icon"
                                  type="button"
                                  variant="ghost"
                                >
                                  <RotateCcw className="size-4" />
                                </Button>
                              )}
                              {unused ? (
                                <Button
                                  aria-label={`删除${item.name}`}
                                  disabled={pending}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `删除未使用的系统朋友“${item.name}”？`,
                                      )
                                    )
                                      deleteMutation.mutate(item.id);
                                  }}
                                  size="icon"
                                  type="button"
                                  variant="ghost"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <footer className="flex items-center gap-3 border-t border-border px-4 py-3">
            <p className="text-xs text-muted tabular-nums">
              第 {page} / {Math.max(totalPages, 1)} 页
            </p>
            <div className="ml-auto flex gap-2">
              <Button
                aria-label="上一页"
                disabled={page <= 1 || agentsQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                size="icon"
                type="button"
                variant="secondary"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                aria-label="下一页"
                disabled={
                  totalPages === 0 ||
                  page >= totalPages ||
                  agentsQuery.isFetching
                }
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                size="icon"
                type="button"
                variant="secondary"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </footer>
        </div>
      )}
      <dialog
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-foreground backdrop:bg-black/30 sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-[min(38rem,100vw)]"
        ref={dialogRef}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      >
        <AgentForm
          editing={Boolean(editing)}
          error={formError}
          form={form}
          onChange={handleChange}
          onClose={() => setDrawerOpen(false)}
          onSubmit={handleSubmit}
          pending={isBusy}
        />
      </dialog>
      <dialog
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-foreground backdrop:bg-black/30 sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-[min(38rem,100vw)]"
        onClose={() => setDetail(null)}
        open={Boolean(detail)}
      >
        {detail ? (
          <AgentDetail detail={detail} onClose={() => setDetail(null)} />
        ) : null}
      </dialog>
    </section>
  );
}
