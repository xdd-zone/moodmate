"use client";

import {
  UserCreateRequestSchema,
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

const PAGE_SIZE = 10;

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  hour12: false,
  timeStyle: "short",
});

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

export function UserManagementPage() {
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const usersQuery = useQuery(
    adminUsersQueryOptions({ page, pageSize: PAGE_SIZE }),
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
          <div className="overflow-x-auto">
            <Table className="min-w-[48rem] table-fixed">
              <TableHeader>
                <TableRow className="bg-surface">
                  <TableHead className="w-60">用户</TableHead>
                  <TableHead className="w-48">角色</TableHead>
                  <TableHead className="w-24">状态</TableHead>
                  <TableHead className="w-40">注册时间</TableHead>
                  <TableHead className="w-40">最后登录</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersQuery.isPending ? (
                  <TableRow>
                    <TableCell className="py-16 text-center" colSpan={5}>
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
                      colSpan={5}
                    >
                      暂无用户
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => <UserRow key={user.id} user={user} />)
                )}
              </TableBody>
            </Table>
          </div>

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
    </section>
  );
}

function UserRow({ user }: { user: UserListItem }) {
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
      <TableCell className="text-xs text-muted tabular-nums">
        {formatTime(user.createdAtMs)}
      </TableCell>
      <TableCell className="text-xs text-muted tabular-nums">
        {formatTime(user.lastLoginAtMs)}
      </TableCell>
    </TableRow>
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
