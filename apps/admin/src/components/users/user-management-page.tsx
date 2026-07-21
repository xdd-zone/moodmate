"use client";

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
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  EllipsisVertical,
  Eye,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Star,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

type UserRole = "admin" | "ops" | "review" | "user";
type UserPlan = "free" | "pro" | "team";
type UserStatus = "active" | "banned" | "inactive";
type StatusFilter = "all" | UserStatus;
type RoleFilter = "all" | UserRole;
type PlanFilter = "all" | UserPlan;

type UserRecord = {
  avatarClass: string;
  handle: string;
  id: string;
  join: string;
  last: string;
  mood: string;
  name: string;
  plan: UserPlan;
  role: UserRole;
  status: UserStatus;
  streak: number;
  total: number;
};

const ROLES: Record<UserRole, { colorVar: string; label: string }> = {
  admin: { colorVar: "var(--theme-mauve)", label: "超级管理员" },
  ops: { colorVar: "var(--theme-blue)", label: "运营" },
  review: { colorVar: "var(--theme-teal)", label: "内容审核" },
  user: { colorVar: "var(--theme-overlay-1)", label: "普通用户" },
};

const PLANS: Record<
  UserPlan,
  { className?: string; label: string; variant: "default" | "secondary" }
> = {
  free: { label: "免费版", variant: "secondary" },
  pro: { label: "专业版", variant: "default" },
  team: {
    className: "border-transparent bg-info-subtle text-info",
    label: "团队版",
    variant: "secondary",
  },
};

const STATUS_CONFIG: Record<UserStatus, { className: string; label: string }> =
  {
    active: {
      className: "border-transparent bg-success-subtle text-success",
      label: "活跃",
    },
    inactive: {
      className:
        "border-transparent bg-warning-subtle text-[var(--theme-peach)]",
      label: "沉睡",
    },
    banned: {
      className: "border-transparent bg-danger-subtle text-danger",
      label: "已封禁",
    },
  };

const STATUS_FILTERS: ReadonlyArray<{ label: string; value: StatusFilter }> = [
  { label: "全部", value: "all" },
  { label: "活跃", value: "active" },
  { label: "沉睡", value: "inactive" },
  { label: "已封禁", value: "banned" },
];

const AVATAR_CLASSES = [
  "bg-[var(--theme-mauve)]",
  "bg-primary",
  "bg-info",
  "bg-[var(--theme-pink)]",
  "bg-[var(--theme-peach)]",
  "bg-success",
] as const;

const NAMES = [
  ["林晚", "linwan"],
  ["陈屿", "chenyu"],
  ["苏晓", "suxiao"],
  ["周野", "zhouye"],
  ["何澄", "hecheng"],
  ["江予", "jiangyu"],
  ["温故", "wengu"],
  ["沈知", "shenzhi"],
  ["顾南", "gunan"],
  ["阮青", "ruanqing"],
  ["白鹭", "bailu"],
  ["叶知秋", "yezhiqiu"],
] as const;

const ROLE_KEYS: readonly UserRole[] = [
  "user",
  "user",
  "user",
  "ops",
  "user",
  "review",
  "user",
  "ops",
  "user",
  "admin",
  "user",
  "review",
];
const PLAN_KEYS: readonly UserPlan[] = [
  "pro",
  "free",
  "team",
  "pro",
  "free",
  "pro",
  "free",
  "team",
  "free",
  "team",
  "pro",
  "free",
];
const ST_KEYS: readonly UserStatus[] = [
  "active",
  "active",
  "inactive",
  "active",
  "banned",
  "active",
  "inactive",
  "active",
  "active",
  "active",
  "inactive",
  "active",
];

const DEMO_USERS = Array.from({ length: 12 }, (_, index) =>
  createDemoUser(index),
);

const STAT_ITEMS: ReadonlyArray<{
  detail: string;
  detailClass: string;
  direction: "down" | "up";
  icon: LucideIcon;
  iconClass: string;
  label: string;
  spark?: readonly number[];
  suffix?: string;
  value: string;
}> = [
  {
    detail: "本周新增 34 位",
    detailClass: "text-success",
    direction: "up",
    icon: Users,
    iconClass: "bg-primary-subtle text-primary-strong",
    label: "注册用户总数",
    value: "861",
  },
  {
    detail: "",
    detailClass: "text-success",
    direction: "up",
    icon: Activity,
    iconClass: "bg-success-subtle text-success",
    label: "近 7 日活跃",
    spark: [50, 62, 55, 74, 68, 82, 76],
    suffix: "/ 861",
    value: "512",
  },
  {
    detail: "付费率 27.6%",
    detailClass: "text-success",
    direction: "up",
    icon: Star,
    iconClass: "bg-info-subtle text-info",
    label: "付费会员",
    value: "238",
  },
  {
    detail: "需人工处理",
    detailClass: "text-danger",
    direction: "down",
    icon: TriangleAlert,
    iconClass: "bg-warning-subtle text-[var(--theme-peach)]",
    label: "待审核 / 封禁",
    value: "7",
  },
];

export function UserManagementPage() {
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword.trim().toLowerCase());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [activeUser, setActiveUser] = useState<UserRecord | null>(null);
  const isDetailOpen = activeUser !== null;

  useEffect(() => {
    if (!isDetailOpen) return;

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setActiveUser(null);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isDetailOpen]);

  const filteredUsers = useMemo(
    () =>
      DEMO_USERS.filter((user) => {
        const statusMatches =
          statusFilter === "all" || user.status === statusFilter;
        const roleMatches = roleFilter === "all" || user.role === roleFilter;
        const planMatches = planFilter === "all" || user.plan === planFilter;
        const keywordMatches =
          deferredKeyword.length === 0 ||
          user.name.toLowerCase().includes(deferredKeyword) ||
          user.handle.toLowerCase().includes(deferredKeyword) ||
          user.id.toLowerCase().includes(deferredKeyword);

        return statusMatches && roleMatches && planMatches && keywordMatches;
      }),
    [deferredKeyword, planFilter, roleFilter, statusFilter],
  );

  const allVisibleSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((user) => selectedIds.has(user.id));

  function toggleUser(userId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleVisibleUsers() {
    setSelectedIds((current) => {
      const next = new Set(current);
      const shouldClear = filteredUsers.every((user) => next.has(user.id));

      for (const user of filteredUsers) {
        if (shouldClear) next.delete(user.id);
        else next.add(user.id);
      }

      return next;
    });
  }

  return (
    <section className="w-full">
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">用户管理</h1>
          <p className="mt-1 text-xs leading-6 text-muted sm:text-sm">
            管理 MoodMate 全平台注册用户的账号、订阅与角色权限，共 861 位用户
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" type="button" variant="outline">
            <Download className="size-4" />
            导出名单
          </Button>
          <Button size="sm" type="button">
            <Plus className="size-4" />
            新增用户
          </Button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_ITEMS.map((item) => (
          <StatCard item={item} key={item.label} />
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3 sm:p-4">
          <label className="relative min-w-0 flex-1 sm:max-w-72 sm:min-w-60">
            <span className="sr-only">按用户名或邮箱筛选</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-disabled" />
            <Input
              className="h-9 min-h-9 bg-background pl-9 text-xs"
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="按用户名 / 邮箱筛选"
              value={keyword}
            />
          </label>

          <div
            aria-label="账号状态"
            className="flex h-9 overflow-hidden rounded-md border border-border"
            role="group"
          >
            {STATUS_FILTERS.map((filter) => {
              const active = filter.value === statusFilter;

              return (
                <button
                  aria-pressed={active}
                  className={
                    active
                      ? "border-r border-border bg-primary-subtle px-3 text-xs font-semibold text-primary-strong outline-none last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                      : "border-r border-border bg-surface px-3 text-xs text-muted outline-none last:border-r-0 hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                  }
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  type="button"
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <label className="relative">
            <span className="sr-only">角色筛选</span>
            <select
              className="h-9 min-w-28 appearance-none rounded-md border border-border bg-background pr-8 pl-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-focus"
              onChange={(event) =>
                setRoleFilter(event.target.value as RoleFilter)
              }
              value={roleFilter}
            >
              <option value="all">全部角色</option>
              <option value="admin">超级管理员</option>
              <option value="ops">运营</option>
              <option value="review">内容审核</option>
              <option value="user">普通用户</option>
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted" />
          </label>

          <label className="relative">
            <span className="sr-only">套餐筛选</span>
            <select
              className="h-9 min-w-28 appearance-none rounded-md border border-border bg-background pr-8 pl-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-focus"
              onChange={(event) =>
                setPlanFilter(event.target.value as PlanFilter)
              }
              value={planFilter}
            >
              <option value="all">全部套餐</option>
              <option value="free">免费版</option>
              <option value="pro">专业版</option>
              <option value="team">团队版</option>
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted" />
          </label>

          <Button
            className="sm:ml-auto"
            disabled={selectedIds.size === 0}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Ban className="size-4" />
            批量封禁
          </Button>
        </div>

        <Table className="min-w-[68rem] table-fixed">
          <TableHeader>
            <TableRow className="bg-surface">
              <TableHead className="w-12">
                <input
                  aria-label="选择当前筛选结果"
                  checked={allVisibleSelected}
                  className="size-4 accent-primary"
                  onChange={toggleVisibleUsers}
                  type="checkbox"
                />
              </TableHead>
              <TableHead className="w-48">用户</TableHead>
              <TableHead className="w-32">角色</TableHead>
              <TableHead className="w-24">套餐</TableHead>
              <TableHead className="w-28">连续打卡</TableHead>
              <TableHead className="w-32">注册时间</TableHead>
              <TableHead className="w-24">状态</TableHead>
              <TableHead className="w-28 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <UserRow
                  isSelected={selectedIds.has(user.id)}
                  key={user.id}
                  onOpen={() => setActiveUser(user)}
                  onToggle={() => toggleUser(user.id)}
                  user={user}
                />
              ))
            ) : (
              <TableRow>
                <TableCell className="py-14 text-center text-muted" colSpan={8}>
                  没有符合条件的用户。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3">
          <p className="text-xs text-muted">
            当前结果：
            <span className="font-semibold text-foreground tabular-nums">
              {filteredUsers.length}
            </span>
            <span className="mx-1.5 text-disabled">·</span>
            已选：
            <span className="font-semibold text-foreground tabular-nums">
              {selectedIds.size}
            </span>
          </p>
          <div aria-label="分页" className="ml-auto flex items-center gap-1">
            <PageButton disabled label="上一页">
              <ChevronLeft className="size-4" />
            </PageButton>
            <PageButton active label="第 1 页">
              1
            </PageButton>
            <PageButton label="第 2 页">2</PageButton>
            <PageButton label="第 3 页">3</PageButton>
            <span className="grid size-8 place-items-center text-xs text-muted">
              …
            </span>
            <PageButton label="第 44 页">44</PageButton>
            <PageButton label="下一页">
              <ChevronRight className="size-4" />
            </PageButton>
          </div>
        </div>
      </Card>

      <UserDetailDialog onClose={() => setActiveUser(null)} user={activeUser} />
    </section>
  );
}

function StatCard({ item }: { item: (typeof STAT_ITEMS)[number] }) {
  const Icon = item.icon;
  const DirectionIcon = item.direction === "up" ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className="p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs text-muted">{item.label}</span>
        <span
          className={`grid size-8 place-items-center rounded-md ${item.iconClass}`}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="font-mono text-2xl leading-none font-semibold tabular-nums sm:text-[1.75rem]">
        {item.value}
        {item.suffix ? (
          <span className="ml-1.5 text-xs font-normal text-muted">
            {item.suffix}
          </span>
        ) : null}
      </div>
      {item.spark ? (
        <div className="mt-2.5 flex h-7 items-end gap-0.5">
          {item.spark.map((height, index) => (
            <span
              className={
                index === item.spark!.length - 1
                  ? "flex-1 rounded-t-sm bg-primary"
                  : "flex-1 rounded-t-sm bg-primary-subtle"
              }
              key={index}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      ) : (
        <div
          className={`mt-2 flex items-center gap-1 text-xs ${item.detailClass}`}
        >
          <DirectionIcon className="size-3.5" />
          {item.detail}
        </div>
      )}
    </Card>
  );
}

function RoleTag({ role }: { role: UserRole }) {
  const config = ROLES[role];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold"
      style={{
        background: `color-mix(in srgb, ${config.colorVar} 15%, transparent)`,
        color: config.colorVar,
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: config.colorVar }}
      />
      {config.label}
    </span>
  );
}

function UserRow({
  isSelected,
  onOpen,
  onToggle,
  user,
}: {
  isSelected: boolean;
  onOpen: () => void;
  onToggle: () => void;
  user: UserRecord;
}) {
  const plan = PLANS[user.plan];
  const status = STATUS_CONFIG[user.status];

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  }

  return (
    <TableRow
      aria-label={`查看${user.name}的用户资料`}
      className={
        isSelected
          ? "group cursor-pointer bg-primary-subtle outline-none hover:bg-primary-subtle focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
          : "group cursor-pointer outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
      }
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <TableCell className="align-middle">
        <input
          aria-label={`选择${user.name}`}
          checked={isSelected}
          className="size-4 accent-primary"
          onChange={onToggle}
          onClick={(event) => event.stopPropagation()}
          type="checkbox"
        />
      </TableCell>
      <TableCell className="align-middle">
        <div className="flex items-center gap-2.5">
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-[var(--theme-base)] ${user.avatarClass}`}
          >
            {user.name.slice(0, 1)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold">
              {user.name}
            </span>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-muted">
              @{user.handle}
            </span>
          </span>
        </div>
      </TableCell>
      <TableCell className="align-middle">
        <RoleTag role={user.role} />
      </TableCell>
      <TableCell className="align-middle">
        <Badge
          className={`px-1.5 text-[0.625rem] ${plan.className ?? ""}`}
          variant={plan.variant}
        >
          {plan.label}
        </Badge>
      </TableCell>
      <TableCell className="align-middle text-xs tabular-nums">
        {user.streak} 天
      </TableCell>
      <TableCell className="align-middle text-xs text-muted tabular-nums">
        {user.join}
      </TableCell>
      <TableCell className="align-middle">
        <Badge className={`gap-1 px-1.5 text-[0.625rem] ${status.className}`}>
          <span className="size-1.5 rounded-full bg-current" />
          {status.label}
        </Badge>
      </TableCell>
      <TableCell className="align-middle">
        <div className="flex justify-end gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
          <RowActionButton label="查看资料" onClick={onOpen}>
            <Eye className="size-3.5" />
          </RowActionButton>
          <RowActionButton label="编辑用户">
            <Pencil className="size-3.5" />
          </RowActionButton>
          <RowActionButton danger label="封禁用户">
            <Ban className="size-3.5" />
          </RowActionButton>
        </div>
      </TableCell>
    </TableRow>
  );
}

function RowActionButton({
  children,
  danger = false,
  label,
  onClick,
}: {
  children: React.ReactNode;
  danger?: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={
        danger
          ? "grid size-8 place-items-center rounded-sm text-muted outline-none hover:bg-danger-subtle hover:text-danger focus-visible:ring-2 focus-visible:ring-focus"
          : "grid size-8 place-items-center rounded-sm text-muted outline-none hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
      }
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function PageButton({
  active = false,
  children,
  disabled = false,
  label,
}: {
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={
        active
          ? "grid size-8 place-items-center rounded-sm bg-primary text-xs font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus"
          : "grid size-8 place-items-center rounded-sm border border-border bg-surface text-xs outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-40"
      }
      disabled={disabled}
      type="button"
    >
      {children}
    </button>
  );
}

function UserDetailDialog({
  onClose,
  user,
}: {
  onClose: () => void;
  user: UserRecord | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (user && !dialog.open) dialog.showModal();
    if (!user && dialog.open) dialog.close();
  }, [user]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  const role = user ? ROLES[user.role] : null;
  const plan = user ? PLANS[user.plan] : null;
  const status = user ? STATUS_CONFIG[user.status] : null;

  return (
    <dialog
      aria-labelledby="user-detail-title"
      className="mood-detail-dialog fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-foreground"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
      onClose={onClose}
      ref={dialogRef}
    >
      {user && role && plan && status ? (
        <aside className="mood-detail-drawer ml-auto flex h-dvh w-full max-w-[27.5rem] flex-col border-l border-border bg-background shadow-soft">
          <header className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-5">
            <span
              className={`grid size-9 place-items-center rounded-full text-xs font-semibold text-[var(--theme-base)] ${user.avatarClass}`}
            >
              {user.name.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <h2
                className="truncate text-sm font-semibold"
                id="user-detail-title"
              >
                {user.name}
              </h2>
              <p className="truncate text-xs text-muted">
                @{user.handle} · moodmate.app
              </p>
            </div>
            <Button
              aria-label="关闭详情"
              className="ml-auto size-11 p-0 sm:size-9 sm:min-h-9"
              onClick={onClose}
              size="icon"
              type="button"
              variant="secondary"
            >
              <X className="size-4" />
            </Button>
          </header>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="mb-6 flex items-center gap-3 rounded-md bg-surface-muted p-4">
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-full text-base font-semibold text-[var(--theme-base)] ${user.avatarClass}`}
              >
                {user.name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold">{user.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  @{user.handle} · {user.id}
                </p>
              </div>
              <Badge
                className={`ml-auto gap-1 px-1.5 text-[0.625rem] ${status.className}`}
              >
                <span className="size-1.5 rounded-full bg-current" />
                {status.label}
              </Badge>
            </div>

            <DetailSection title="账号信息">
              <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
                <dt className="text-muted">用户 ID</dt>
                <dd className="m-0 font-medium tabular-nums">{user.id}</dd>
                <dt className="text-muted">角色</dt>
                <dd className="m-0">{role.label}</dd>
                <dt className="text-muted">套餐</dt>
                <dd className="m-0">{plan.label}</dd>
                <dt className="text-muted">注册时间</dt>
                <dd className="m-0 tabular-nums">{user.join}</dd>
                <dt className="text-muted">最近登录</dt>
                <dd className="m-0 tabular-nums">{user.last}</dd>
                <dt className="text-muted">设备</dt>
                <dd className="m-0">iOS App · v2.4.1</dd>
              </dl>
            </DetailSection>

            <DetailSection title="使用概况">
              <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
                <dt className="text-muted">累计打卡</dt>
                <dd className="m-0 tabular-nums">{user.total} 次</dd>
                <dt className="text-muted">连续打卡</dt>
                <dd className="m-0 tabular-nums">{user.streak} 天</dd>
                <dt className="text-muted">平均心情分</dt>
                <dd className="m-0 tabular-nums">{user.mood} / 10</dd>
              </dl>
            </DetailSection>

            <DetailSection title="操作记录">
              <ol className="relative ml-1 border-l border-border pl-5 text-xs">
                <TimelineItem time={`${user.join} 08:30`}>
                  完成账号注册
                </TimelineItem>
                <TimelineItem time="2026-05-12 14:22">
                  升级为付费会员
                </TimelineItem>
                <TimelineItem last time="2026-06-03 10:08">
                  运营调整角色为「运营」
                </TimelineItem>
              </ol>
            </DetailSection>
          </div>

          <footer className="flex flex-wrap gap-2 border-t border-border p-4 sm:px-5">
            <Button className="flex-1" size="sm" type="button">
              <Pencil className="size-4" />
              编辑资料
            </Button>
            <Button size="sm" type="button" variant="outline">
              <KeyRound className="size-4" />
              重置密码
            </Button>
            <Button
              aria-label="更多操作"
              className="size-9 min-h-9 p-0"
              size="icon"
              type="button"
              variant="ghost"
            >
              <EllipsisVertical className="size-4" />
            </Button>
          </footer>
        </aside>
      ) : null}
    </dialog>
  );
}

function DetailSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="mb-2.5 text-[0.6875rem] font-semibold text-muted uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function TimelineItem({
  children,
  last = false,
  time,
}: {
  children: React.ReactNode;
  last?: boolean;
  time: string;
}) {
  return (
    <li className={last ? "relative" : "relative pb-4"}>
      <span className="absolute top-1 -left-[1.47rem] size-2 rounded-full bg-primary ring-2 ring-background" />
      <p>{children}</p>
      <p className="mt-1 text-[0.6875rem] text-disabled tabular-nums">{time}</p>
    </li>
  );
}

function createDemoUser(index: number): UserRecord {
  const person = NAMES[index % NAMES.length] ?? NAMES[0];
  const role = ROLE_KEYS[index] ?? "user";
  const plan = PLAN_KEYS[index] ?? "free";
  const status = ST_KEYS[index] ?? "active";
  const total = 40 + ((index * 37) % 900);
  const streak = (index * 5) % 46;
  const mood = (5.2 + ((index * 7) % 45) / 10).toFixed(1);
  const joinMonth = String(1 + (index % 6)).padStart(2, "0");
  const joinDay = String(3 + ((index * 3) % 25)).padStart(2, "0");
  const loginHour = String(8 + (index % 12)).padStart(2, "0");
  const loginMinute = String((index * 11) % 60).padStart(2, "0");
  const lastDay = String(18 - (index % 14)).padStart(2, "0");

  return {
    avatarClass: AVATAR_CLASSES[index % AVATAR_CLASSES.length] ?? "bg-primary",
    handle: person[1],
    id: `#U-${String(10480 - index).padStart(5, "0")}`,
    join: `2025-${joinMonth}-${joinDay}`,
    last:
      status === "inactive"
        ? `2026-04-${joinDay} ${loginHour}:${loginMinute}`
        : `2026-07-${lastDay} ${loginHour}:${loginMinute}`,
    mood,
    name: person[0],
    plan,
    role,
    status,
    streak,
    total,
  };
}
