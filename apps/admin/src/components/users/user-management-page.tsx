"use client";

import {
  AiCallScenarioSchema,
  AiCallStatusSchema,
  UserCreateRequestSchema,
  type AdminAiCallListQuery,
  type AdminAiCallListItem,
  type Role,
  type UserCreateRequest,
  type UserListItem,
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Plus,
  Coins,
  RotateCcw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { adminRolesQueryOptions } from "@/src/api/roles.query";
import {
  adminUsersQueryOptions,
  createAdminUserMutationOptions,
} from "@/src/api/users.query";
import {
  adminUserCallsQueryOptions,
  adminUserDetailQueryOptions,
  adminUserUsageQueryOptions,
} from "@/src/api/operations.query";

const PAGE_SIZE = 10;
const UNKNOWN_CALL_AFTER_MS = 10 * 60 * 1000;

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  hour12: false,
  timeStyle: "short",
});
const numberFormatter = new Intl.NumberFormat("zh-CN");

const STATUS_LABELS: Record<UserListItem["status"], string> = {
  active: "正常",
  deleted: "已删除",
  suspended: "已暂停",
};

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatTime(value: number | null): string {
  return value === null ? "从未登录" : dateTimeFormatter.format(value);
}

function formatCallTime(value: number | null): string {
  return value === null ? "暂无调用" : dateTimeFormatter.format(value);
}

function formatToken(
  usageStatus: "pending" | "reported" | "unavailable",
  value: number | null,
): number | string {
  if (usageStatus === "pending") return "待完成";
  if (usageStatus === "unavailable") return "上游未返回";
  return value ?? 0;
}

function formatCallStatus(
  call: Pick<AdminAiCallListItem, "startedAtMs" | "status">,
): string {
  if (
    call.status === "started" &&
    Date.now() - call.startedAtMs > UNKNOWN_CALL_AFTER_MS
  ) {
    return "状态未知";
  }

  return {
    aborted: "已中止",
    completed: "已完成",
    failed: "失败",
    started: "进行中",
  }[call.status];
}

export function UserManagementPage() {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<"active" | "suspended" | "">("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailUserId, setDetailUserId] = useState("");
  const [usageUserId, setUsageUserId] = useState("");
  const usersQuery = useQuery(
    adminUsersQueryOptions({
      page,
      pageSize: PAGE_SIZE,
      ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
      ...(status ? { status } : {}),
    }),
  );
  const rolesQuery = useQuery(adminRolesQueryOptions());
  const users = usersQuery.data?.items ?? [];
  const total = usersQuery.data?.total ?? 0;
  const totalPages = usersQuery.data?.totalPages ?? 0;
  const activeRoles = useMemo(
    () =>
      rolesQuery.data?.items.filter((role) => role.status === "active") ?? [],
    [rolesQuery.data?.items],
  );

  useEffect(() => {
    const userId = new URLSearchParams(window.location.search).get("usage");
    if (userId) setUsageUserId(userId);
  }, []);

  return (
    <section className="w-full">
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">用户管理</h1>
          <p className="mt-1 text-xs leading-6 text-muted sm:text-sm">
            {usersQuery.isSuccess ? `共 ${total} 位用户` : "用户数据"}
          </p>
        </div>
        <Button
          className="ml-auto"
          onClick={() => setDrawerOpen(true)}
          size="sm"
          type="button"
        >
          <Plus className="size-4" />
          新建用户
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          aria-label="搜索用户"
          className="w-full sm:w-64"
          onChange={(event) => {
            setKeyword(event.currentTarget.value);
            setPage(1);
          }}
          placeholder="搜索显示名或邮箱"
          value={keyword}
        />
        <select
          aria-label="用户状态筛选"
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          onChange={(event) => {
            const value = event.currentTarget.value;
            setStatus(value === "active" || value === "suspended" ? value : "");
            setPage(1);
          }}
          value={status}
        >
          <option value="">全部状态</option>
          <option value="active">正常</option>
          <option value="suspended">已暂停</option>
        </select>
      </div>

      {usersQuery.isError ? (
        <Card className="flex flex-col items-start gap-3 p-5">
          <p className="text-sm text-danger" role="alert">
            {toErrorMessage(usersQuery.error, "用户列表加载失败，请稍后重试")}
          </p>
          <Button
            onClick={() => void usersQuery.refetch()}
            size="sm"
            type="button"
            variant="secondary"
          >
            <RotateCcw className="size-4" />
            重新加载
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table
            className="min-w-[104rem] table-fixed"
            containerClassName="admin-table-scroll admin-table-scroll-framed"
          >
            <TableHeader>
              <TableRow className="bg-surface">
                <TableHead className="w-64">用户</TableHead>
                <TableHead className="w-72">角色</TableHead>
                <TableHead className="w-28">状态</TableHead>
                <TableHead className="w-40">注册时间</TableHead>
                <TableHead className="w-40">最后登录</TableHead>
                <TableHead className="w-40">最近活跃</TableHead>
                <TableHead className="w-28">单聊消息</TableHead>
                <TableHead className="w-28">群聊消息</TableHead>
                <TableHead className="w-24">朋友</TableHead>
                <TableHead className="w-24">群聊</TableHead>
                <TableHead className="w-28">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.isPending ? (
                <TableRow>
                  <TableCell className="py-16 text-center" colSpan={11}>
                    <span className="inline-flex items-center gap-2 text-sm text-muted">
                      <LoaderCircle className="size-4 animate-spin" />
                      正在加载用户
                    </span>
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="py-16 text-center text-sm text-muted"
                    colSpan={11}
                  >
                    暂无用户
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <UserRow
                    key={user.id}
                    onDetail={() => setDetailUserId(user.id)}
                    onUsage={() => setUsageUserId(user.id)}
                    user={user}
                  />
                ))
              )}
            </TableBody>
          </Table>

          <footer className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3">
            <p className="text-xs text-muted tabular-nums">
              第 {page} / {Math.max(totalPages, 1)} 页
            </p>
            <div className="ml-auto flex gap-2">
              <Button
                aria-label="上一页"
                className="p-0"
                disabled={page <= 1 || usersQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                size="icon"
                title="上一页"
                type="button"
                variant="secondary"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                aria-label="下一页"
                className="p-0"
                disabled={
                  totalPages === 0 ||
                  page >= totalPages ||
                  usersQuery.isFetching
                }
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                size="icon"
                title="下一页"
                type="button"
                variant="secondary"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </footer>
        </Card>
      )}

      <NewUserDrawer
        activeRoles={activeRoles}
        onClose={() => setDrawerOpen(false)}
        onCreated={() => setPage(1)}
        open={drawerOpen}
        rolesError={rolesQuery.isError ? rolesQuery.error : null}
        rolesPending={rolesQuery.isPending}
      />
      <UserDetailDrawer
        key={detailUserId || "closed-detail"}
        onClose={() => setDetailUserId("")}
        userId={detailUserId}
      />
      <UserUsageDrawer
        key={usageUserId || "closed-usage"}
        onClose={() => setUsageUserId("")}
        userId={usageUserId}
      />
    </section>
  );
}

function UserRow({
  user,
  onDetail,
  onUsage,
}: {
  user: UserListItem;
  onDetail: () => void;
  onUsage: () => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{user.displayName}</p>
          <p className="mt-0.5 truncate text-[0.6875rem] text-muted">
            {user.email}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1.5">
          {user.roles.length > 0 ? (
            user.roles.map((role) => (
              <Badge key={role.id} variant="secondary">
                {role.name}（{role.applicationCode}）
              </Badge>
            ))
          ) : (
            <span className="text-xs text-disabled">未分配</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={user.status === "active" ? "secondary" : "outline"}>
          {STATUS_LABELS[user.status]}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted tabular-nums">
        {formatTime(user.createdAtMs)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted tabular-nums">
        {formatTime(user.lastLoginAtMs)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted tabular-nums">
        {formatTime(user.lastActiveAtMs)}
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">
        {user.directMessageCount}
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">
        {user.groupMessageCount}
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">
        {user.friendCount}
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">
        {user.groupChatCount}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            aria-label={`查看${user.displayName}详情`}
            onClick={onDetail}
            size="icon"
            title="用户详情"
            variant="ghost"
          >
            <Eye className="size-4" />
          </Button>
          <Button
            aria-label={`查看${user.displayName}的 Token 用量`}
            onClick={onUsage}
            size="icon"
            title="Token 用量"
            variant="ghost"
          >
            <Coins className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function UserDetailDrawer({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const detail = useQuery(adminUserDetailQueryOptions(userId));
  if (!userId) return null;
  const data = detail.data;

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl overflow-y-auto border-l border-border bg-background p-6 shadow-xl">
      <div className="flex items-start gap-4">
        <div>
          <h2 className="text-lg font-semibold">
            {data?.user.displayName ?? "用户详情"}
          </h2>
          <p className="mt-1 text-xs text-muted">{data?.user.email}</p>
        </div>
        <Button
          aria-label="关闭用户详情"
          className="ml-auto"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X className="size-4" />
        </Button>
      </div>
      {detail.isPending ? (
        <p className="mt-6 text-sm text-muted">正在加载用户详情</p>
      ) : detail.isError || !data ? (
        <p className="mt-6 text-sm text-danger" role="alert">
          {toErrorMessage(detail.error, "用户详情加载失败")}
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          <section>
            <h3 className="text-sm font-semibold">账号信息</h3>
            <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">状态</dt>
                <dd className="mt-1">{STATUS_LABELS[data.user.status]}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">角色</dt>
                <dd className="mt-1">
                  {data.user.roles.map((role) => role.name).join("、") ||
                    "未分配"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">注册时间</dt>
                <dd className="mt-1 tabular-nums">
                  {formatTime(data.user.createdAtMs)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">最近活跃</dt>
                <dd className="mt-1 tabular-nums">
                  {formatTime(data.user.lastActiveAtMs)}
                </dd>
              </div>
            </dl>
          </section>
          <section>
            <h3 className="text-sm font-semibold">使用摘要</h3>
            <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border sm:grid-cols-4">
              {[
                ["朋友", data.summary.friendCount],
                ["单聊", data.summary.directConversationCount],
                ["单聊消息", data.summary.directMessageCount],
                ["群聊", data.summary.groupConversationCount],
                ["群聊消息", data.summary.groupMessageCount],
                ["AI 调用", data.summary.aiCallCount],
                ["失败调用", data.summary.failedAiCallCount],
                ["Token", data.summary.totalTokens],
              ].map(([label, value]) => (
                <div className="bg-background p-3" key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums">
                    {numberFormatter.format(Number(value))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section>
            <h3 className="text-sm font-semibold">朋友与单聊</h3>
            <Table
              className="mt-3 min-w-[44rem] table-fixed"
              containerClassName="admin-table-scroll admin-table-scroll-compact"
            >
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">朋友</TableHead>
                  <TableHead className="w-24">来源</TableHead>
                  <TableHead className="w-28">状态</TableHead>
                  <TableHead className="w-24">消息</TableHead>
                  <TableHead className="w-40">最近活跃</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.friends.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-center text-muted" colSpan={5}>
                      暂无朋友或单聊
                    </TableCell>
                  </TableRow>
                ) : (
                  data.friends.map((friend) => (
                    <TableRow key={friend.id}>
                      <TableCell className="truncate" title={friend.name}>
                        {friend.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {friend.source === "system" ? "系统" : "用户"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {friend.status}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {friend.messageCount}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatCallTime(friend.lastActiveAtMs)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </section>
          <section>
            <h3 className="text-sm font-semibold">群聊</h3>
            {data.groupChats.length === 0 ? (
              <p className="mt-3 text-sm text-muted">暂无群聊</p>
            ) : (
              <ul className="mt-3 divide-y divide-border border-t border-border">
                {data.groupChats.map((group) => (
                  <li className="flex gap-4 py-3 text-sm" key={group.id}>
                    <span className="min-w-0 flex-1 truncate">
                      {group.title}
                    </span>
                    <span className="text-muted">
                      {group.messageCount} 条消息
                    </span>
                    <time className="text-muted">
                      {formatCallTime(group.lastActiveAtMs)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}

function UserUsageDrawer({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"summary" | "calls">("summary");
  const [callPage, setCallPage] = useState(1);
  const [agentId, setAgentId] = useState("");
  const [scenario, setScenario] = useState<
    AdminAiCallListQuery["scenario"] | ""
  >("");
  const [model, setModel] = useState("");
  const [status, setStatus] = useState<AdminAiCallListQuery["status"] | "">("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const detail = useQuery(adminUserDetailQueryOptions(userId));
  const usage = useQuery({
    ...adminUserUsageQueryOptions(userId),
    enabled: Boolean(userId),
  });
  const callQuery: AdminAiCallListQuery = {
    page: callPage,
    pageSize: 20,
    ...(agentId ? { agentId } : {}),
    ...(scenario ? { scenario } : {}),
    ...(model.trim() ? { model: model.trim() } : {}),
    ...(status ? { status } : {}),
    ...(startAt ? { startAtMs: new Date(startAt).getTime() } : {}),
    ...(endAt ? { endAtMs: new Date(endAt).getTime() } : {}),
  };
  const calls = useQuery({
    ...adminUserCallsQueryOptions(userId, callQuery),
    enabled: Boolean(userId) && tab === "calls",
  });
  if (!userId) return null;
  const user = detail.data?.user;
  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl overflow-y-auto border-l border-border bg-background p-6 shadow-xl">
      <div className="flex items-start">
        <div>
          <h2 className="text-lg font-semibold">
            {user ? `${user.displayName}的 Token 用量` : "用户 Token 用量"}
          </h2>
          <p className="mt-1 text-xs text-muted">{user?.email}</p>
        </div>
        <Button
          aria-label="关闭 Token 用量"
          className="ml-auto"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="mt-6 flex border-b border-border" role="tablist">
        {(
          [
            ["summary", "用量汇总"],
            ["calls", "调用明细"],
          ] as const
        ).map(([value, label]) => (
          <button
            aria-selected={tab === value}
            className={`border-b-2 px-4 py-2 text-sm ${tab === value ? "border-primary text-foreground" : "border-transparent text-muted"}`}
            key={value}
            onClick={() => setTab(value)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "summary" ? (
        usage.isError ? (
          <p className="mt-6 text-sm text-danger" role="alert">
            {toErrorMessage(usage.error, "Token 用量加载失败")}
          </p>
        ) : usage.data ? (
          <>
            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
              {[
                ["累计输入", usage.data.total.promptTokens],
                ["累计输出", usage.data.total.completionTokens],
                ["累计 Token", usage.data.total.totalTokens],
                ["累计调用", usage.data.total.callCount],
                ["今日输入", usage.data.today.promptTokens],
                ["今日输出", usage.data.today.completionTokens],
                ["今日 Token", usage.data.today.totalTokens],
                ["今日调用", usage.data.today.callCount],
                ["失败调用", usage.data.failedCallCount],
                ["最近调用", formatCallTime(usage.data.lastCalledAtMs)],
              ].map(([label, value]) => (
                <div className="bg-background p-4" key={label}>
                  <p className="text-xs text-muted">{label}</p>
                  <strong className="mt-2 block text-base tabular-nums">
                    {value}
                  </strong>
                </div>
              ))}
            </div>
            <h3 className="mt-7 text-sm font-semibold">用量主体</h3>
            <Table
              className="mt-3 min-w-[91rem] table-fixed"
              containerClassName="admin-table-scroll admin-table-scroll-compact"
            >
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">主体</TableHead>
                  <TableHead className="w-28">类型</TableHead>
                  <TableHead className="w-24">来源</TableHead>
                  <TableHead className="w-28">累计输入</TableHead>
                  <TableHead className="w-28">累计输出</TableHead>
                  <TableHead className="w-28">累计总量</TableHead>
                  <TableHead className="w-28">累计调用</TableHead>
                  <TableHead className="w-28">今日输入</TableHead>
                  <TableHead className="w-28">今日输出</TableHead>
                  <TableHead className="w-28">今日总量</TableHead>
                  <TableHead className="w-28">今日调用</TableHead>
                  <TableHead className="w-40">最近调用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.data.subjects.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="py-8 text-center text-muted"
                      colSpan={12}
                    >
                      暂无调用记录
                    </TableCell>
                  </TableRow>
                ) : (
                  usage.data.subjects.map((subject) => (
                    <TableRow key={subject.agentId ?? "system"}>
                      <TableCell
                        className="truncate"
                        title={subject.agentName ?? "系统流程"}
                      >
                        {subject.agentName ?? "系统流程"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {subject.subjectType === "agent" ? "朋友" : "系统流程"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {subject.agentSource === "system"
                          ? "系统"
                          : subject.agentSource === "user"
                            ? "用户"
                            : "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {subject.total.promptTokens}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {subject.total.completionTokens}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {subject.total.totalTokens}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {subject.total.callCount}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {subject.today.promptTokens}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {subject.today.completionTokens}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {subject.today.totalTokens}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {subject.today.callCount}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatCallTime(subject.lastCalledAtMs)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </>
        ) : (
          <p className="mt-6 text-sm text-muted">正在加载用量</p>
        )
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <select
              aria-label="朋友筛选"
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              onChange={(event) => {
                setAgentId(event.currentTarget.value);
                setCallPage(1);
              }}
              value={agentId}
            >
              <option value="">全部主体</option>
              {usage.data?.subjects
                .filter((subject) => subject.agentId)
                .map((subject) => (
                  <option key={subject.agentId} value={subject.agentId ?? ""}>
                    {subject.agentName}
                  </option>
                ))}
            </select>
            <select
              aria-label="业务场景筛选"
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              onChange={(event) => {
                const parsed = AiCallScenarioSchema.safeParse(
                  event.currentTarget.value,
                );
                setScenario(parsed.success ? parsed.data : "");
                setCallPage(1);
              }}
              value={scenario}
            >
              <option value="">全部场景</option>
              {AiCallScenarioSchema.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              aria-label="调用状态筛选"
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              onChange={(event) => {
                const parsed = AiCallStatusSchema.safeParse(
                  event.currentTarget.value,
                );
                setStatus(parsed.success ? parsed.data : "");
                setCallPage(1);
              }}
              value={status}
            >
              <option value="">全部状态</option>
              <option value="started">进行中</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
              <option value="aborted">已中止</option>
            </select>
            <Input
              aria-label="模型筛选"
              onChange={(event) => {
                setModel(event.currentTarget.value);
                setCallPage(1);
              }}
              placeholder="模型名称"
              value={model}
            />
            <Input
              aria-label="开始时间"
              onChange={(event) => {
                setStartAt(event.currentTarget.value);
                setCallPage(1);
              }}
              type="datetime-local"
              value={startAt}
            />
            <Input
              aria-label="结束时间"
              onChange={(event) => {
                setEndAt(event.currentTarget.value);
                setCallPage(1);
              }}
              type="datetime-local"
              value={endAt}
            />
          </div>
          {calls.isError ? (
            <p className="mt-5 text-sm text-danger" role="alert">
              {toErrorMessage(calls.error, "调用明细加载失败")}
            </p>
          ) : (
            <Table
              className="mt-5 min-w-[125rem] table-fixed"
              containerClassName="admin-table-scroll admin-table-scroll-compact"
            >
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">时间</TableHead>
                  <TableHead className="w-40">场景</TableHead>
                  <TableHead className="w-48">主体</TableHead>
                  <TableHead className="w-64">会话</TableHead>
                  <TableHead className="w-64">Provider / 模型</TableHead>
                  <TableHead className="w-28">输入</TableHead>
                  <TableHead className="w-28">输出</TableHead>
                  <TableHead className="w-28">总量</TableHead>
                  <TableHead className="w-28">耗时</TableHead>
                  <TableHead className="w-28">状态</TableHead>
                  <TableHead className="w-40">错误</TableHead>
                  <TableHead className="w-64">requestId</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.data && calls.data.items.length > 0 ? (
                  calls.data.items.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatTime(call.startedAtMs)}
                      </TableCell>
                      <TableCell className="truncate" title={call.scenario}>
                        {call.scenario}
                      </TableCell>
                      <TableCell
                        className="truncate"
                        title={call.agentName ?? "系统流程"}
                      >
                        {call.agentName ?? "系统流程"}
                      </TableCell>
                      <TableCell className="truncate">
                        {call.conversationType === "none"
                          ? "-"
                          : `${call.conversationType} · ${call.conversationId ?? "-"}`}
                      </TableCell>
                      <TableCell className="truncate">
                        {call.providerName} / {call.model}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatToken(call.usageStatus, call.promptTokens)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatToken(call.usageStatus, call.completionTokens)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatToken(call.usageStatus, call.totalTokens)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {call.durationMs === null
                          ? "-"
                          : `${call.durationMs} ms`}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatCallStatus(call)}
                      </TableCell>
                      <TableCell
                        className="truncate"
                        title={call.errorCode ?? "-"}
                      >
                        {call.errorCode ?? "-"}
                      </TableCell>
                      <TableCell className="truncate" title={call.requestId}>
                        {call.requestId}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      className="py-8 text-center text-muted"
                      colSpan={12}
                    >
                      {calls.isPending ? "正在加载调用明细" : "暂无调用记录"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          <footer className="mt-4 flex items-center gap-3">
            <p className="text-xs text-muted tabular-nums">
              第 {callPage} / {Math.max(calls.data?.totalPages ?? 0, 1)} 页
            </p>
            <div className="ml-auto flex gap-2">
              <Button
                aria-label="上一页调用明细"
                disabled={callPage <= 1 || calls.isFetching}
                onClick={() =>
                  setCallPage((current) => Math.max(1, current - 1))
                }
                size="icon"
                type="button"
                variant="secondary"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                aria-label="下一页调用明细"
                disabled={
                  !calls.data?.totalPages ||
                  callPage >= calls.data.totalPages ||
                  calls.isFetching
                }
                onClick={() =>
                  setCallPage((current) =>
                    Math.min(calls.data?.totalPages ?? current, current + 1),
                  )
                }
                size="icon"
                type="button"
                variant="secondary"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </footer>
        </>
      )}
    </aside>
  );
}

function NewUserDrawer({
  activeRoles,
  onClose,
  onCreated,
  open,
  rolesError,
  rolesPending,
}: {
  activeRoles: readonly Role[];
  onClose: () => void;
  onCreated: () => void;
  open: boolean;
  rolesError: unknown;
  rolesPending: boolean;
}) {
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const createMutation = useMutation(
    createAdminUserMutationOptions(queryClient),
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      setDisplayName("");
      setEmail("");
      setPassword("");
      setRoleId(activeRoles[0]?.id ?? "");
      setShowPassword(false);
      setFormError("");
      const focusTimer = window.setTimeout(
        () => displayNameRef.current?.focus(),
        220,
      );

      return () => window.clearTimeout(focusTimer);
    }

    if (!open && dialog.open) dialog.close();
  }, [activeRoles, open]);

  useEffect(() => {
    if (roleId || activeRoles.length === 0) return;
    setRoleId(activeRoles[0]?.id ?? "");
  }, [activeRoles, roleId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createMutation.isPending) return;

    const payload: UserCreateRequest = {
      displayName,
      email,
      password,
      roleId,
    };
    const parsed = UserCreateRequestSchema.safeParse(payload);

    if (!parsed.success) {
      if (
        !UserCreateRequestSchema.shape.displayName.safeParse(displayName)
          .success
      ) {
        setFormError("请输入 1 到 80 个字符的显示名。");
      } else if (
        !UserCreateRequestSchema.shape.email.safeParse(email).success
      ) {
        setFormError("请输入有效的邮箱地址。");
      } else if (
        !UserCreateRequestSchema.shape.password.safeParse(password).success
      ) {
        setFormError("密码长度必须为 8 到 128 个字符。");
      } else {
        setFormError("请选择一个可用角色。");
      }
      return;
    }

    setFormError("");
    createMutation.mutate(parsed.data, {
      onError: (error) => {
        setFormError(toErrorMessage(error, "用户创建失败，请稍后重试"));
      },
      onSuccess: () => {
        onCreated();
        onClose();
      },
    });
  }

  const roleStatusMessage = rolesError
    ? toErrorMessage(rolesError, "角色列表加载失败，请稍后重试")
    : rolesPending
      ? "正在加载角色"
      : activeRoles.length === 0
        ? "当前没有可分配的角色"
        : "";

  return (
    <dialog
      aria-labelledby="new-user-title"
      className="mood-detail-dialog fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-foreground"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <aside className="mood-detail-drawer ml-auto flex h-dvh w-full max-w-[27.5rem] flex-col border-l border-border bg-background shadow-soft">
        <header className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold" id="new-user-title">
              新建用户
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              创建登录凭据并分配一个初始角色
            </p>
          </div>
          <Button
            aria-label="关闭新建用户抽屉"
            className="ml-auto p-0"
            onClick={onClose}
            size="icon"
            title="关闭"
            type="button"
            variant="secondary"
          >
            <X className="size-4" />
          </Button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex-1 overflow-y-auto p-5">
            <FieldLabel htmlFor="userDisplayName">显示名</FieldLabel>
            <Input
              autoComplete="off"
              className="bg-background text-xs"
              disabled={createMutation.isPending}
              id="userDisplayName"
              maxLength={80}
              onChange={(event) => setDisplayName(event.target.value)}
              ref={displayNameRef}
              value={displayName}
            />

            <FieldLabel className="mt-3" htmlFor="userEmail">
              邮箱
            </FieldLabel>
            <Input
              autoComplete="email"
              className="bg-background text-xs"
              disabled={createMutation.isPending}
              id="userEmail"
              maxLength={254}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />

            <FieldLabel className="mt-3" htmlFor="userPassword">
              初始密码
            </FieldLabel>
            <div className="relative">
              <Input
                autoComplete="new-password"
                className="bg-background pr-10 text-xs"
                disabled={createMutation.isPending}
                id="userPassword"
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                onClick={() => setShowPassword((current) => !current)}
                title={showPassword ? "隐藏密码" : "显示密码"}
                type="button"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>

            <FieldLabel className="mt-3" htmlFor="userRole">
              初始角色
            </FieldLabel>
            <div className="relative">
              <select
                className="h-9 w-full appearance-none rounded-md border border-border bg-background pr-8 pl-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60"
                disabled={
                  createMutation.isPending ||
                  rolesPending ||
                  activeRoles.length === 0
                }
                id="userRole"
                onChange={(event) => setRoleId(event.target.value)}
                value={roleId}
              >
                {activeRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}（{role.applicationCode}）
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted" />
            </div>
            {roleStatusMessage ? (
              <p className="mt-1.5 text-[0.6875rem] text-muted">
                {roleStatusMessage}
              </p>
            ) : null}

            <p
              className="mt-3 min-h-4 text-[0.6875rem] text-danger"
              role="alert"
            >
              {formError}
            </p>
          </div>

          <footer className="flex gap-2.5 border-t border-border p-5">
            <Button
              className="flex-1"
              disabled={createMutation.isPending}
              onClick={onClose}
              size="sm"
              type="button"
              variant="secondary"
            >
              取消
            </Button>
            <Button
              className="flex-1"
              disabled={createMutation.isPending || activeRoles.length === 0}
              size="sm"
              type="submit"
            >
              {createMutation.isPending ? "创建中…" : "创建用户"}
            </Button>
          </footer>
        </form>
      </aside>
    </dialog>
  );
}

function FieldLabel({
  children,
  className = "",
  htmlFor,
}: {
  children: React.ReactNode;
  className?: string;
  htmlFor: string;
}) {
  return (
    <label
      className={`${className} mb-1.5 block text-[0.6875rem] font-semibold text-muted`}
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}
