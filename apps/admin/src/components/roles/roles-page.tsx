"use client";

import {
  RoleCreateRequestSchema,
  type Role,
  type RoleCreateRequest,
} from "@repo/contracts";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Lock, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import {
  createAdminRole,
  deleteAdminRole,
  disableAdminRole,
} from "@/src/api/roles.api";
import { adminRoleKeys, adminRolesQueryOptions } from "@/src/api/roles.query";

const STATUS_LABELS: Record<Role["status"], string> = {
  active: "启用",
  deleted: "已删除",
  disabled: "已停用",
};

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

export function RolesPage() {
  const queryClient = useQueryClient();
  const rolesQuery = useQuery(adminRolesQueryOptions());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionError, setActionError] = useState("");

  async function invalidateRoles() {
    await queryClient.invalidateQueries({ queryKey: adminRoleKeys.all });
  }

  const disableMutation = useMutation({
    mutationFn: disableAdminRole,
    onError: (error) => {
      setActionError(toErrorMessage(error, "停用角色失败，请稍后重试"));
    },
    onSuccess: async () => {
      setActionError("");
      await invalidateRoles();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminRole,
    onError: (error) => {
      setActionError(toErrorMessage(error, "删除角色失败，请稍后重试"));
    },
    onSuccess: async () => {
      setActionError("");
      await invalidateRoles();
    },
  });

  const roles = rolesQuery.data?.items ?? [];

  function isRolePending(roleId: string) {
    return (
      (disableMutation.isPending && disableMutation.variables === roleId) ||
      (deleteMutation.isPending && deleteMutation.variables === roleId)
    );
  }

  function handleDisable(role: Role) {
    if (role.isProtected) return;
    if (!window.confirm(`停用角色“${role.name}”？该角色将不再生效。`)) return;
    disableMutation.mutate(role.id);
  }

  function handleDelete(role: Role) {
    if (role.isProtected) return;
    if (!window.confirm(`删除角色“${role.name}”？该操作不可恢复。`)) return;
    deleteMutation.mutate(role.id);
  }

  return (
    <section className="w-full">
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">角色管理</h1>
          <p className="mt-1 text-xs leading-6 text-muted sm:text-sm">
            按 admin 与 web 应用维度管理角色，内置角色不能停用或删除
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={() => setDrawerOpen(true)} size="sm" type="button">
            <Plus className="size-4" />
            新建角色
          </Button>
        </div>
      </div>

      {actionError ? (
        <p
          className="mb-4 rounded-md border border-danger bg-surface px-4 py-3 text-xs text-danger"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}

      {rolesQuery.isError ? (
        <Card className="flex flex-col items-start gap-3 p-5">
          <p className="text-sm text-danger" role="alert">
            {toErrorMessage(rolesQuery.error, "角色列表加载失败，请稍后重试")}
          </p>
          <Button
            onClick={() => void rolesQuery.refetch()}
            size="sm"
            type="button"
            variant="outline"
          >
            <RotateCcw className="size-4" />
            重试
          </Button>
        </Card>
      ) : rolesQuery.isPending ? (
        <Card className="p-5">
          <p className="text-sm text-muted">正在加载角色列表…</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["角色", "code", "应用", "状态", "创建时间", "操作"].map(
                    (label) => (
                      <th
                        className="px-3.5 py-3 text-left text-[0.6875rem] font-semibold text-muted uppercase"
                        key={label}
                      >
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {roles.length > 0 ? (
                  roles.map((role) => (
                    <RoleRow
                      isPending={isRolePending(role.id)}
                      key={role.id}
                      onDelete={() => handleDelete(role)}
                      onDisable={() => handleDisable(role)}
                      role={role}
                    />
                  ))
                ) : (
                  <tr>
                    <td
                      className="px-5 py-10 text-center text-sm text-muted"
                      colSpan={6}
                    >
                      暂无角色
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <NewRoleDrawer onClose={() => setDrawerOpen(false)} open={drawerOpen} />
    </section>
  );
}

function RoleRow({
  isPending,
  onDelete,
  onDisable,
  role,
}: {
  isPending: boolean;
  onDelete: () => void;
  onDisable: () => void;
  role: Role;
}) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">{role.name}</span>
          {role.isProtected ? (
            <Badge variant="secondary">
              <Lock className="size-3" />
              内置
            </Badge>
          ) : null}
        </div>
      </td>
      <td className="px-3.5 py-3 text-xs text-muted">{role.code}</td>
      <td className="px-3.5 py-3">
        <Badge variant="outline">{role.applicationCode}</Badge>
      </td>
      <td className="px-3.5 py-3">
        <Badge variant={role.status === "active" ? "secondary" : "outline"}>
          {STATUS_LABELS[role.status]}
        </Badge>
      </td>
      <td className="px-3.5 py-3 text-xs text-muted tabular-nums">
        {formatTime(role.createdAtMs)}
      </td>
      <td className="px-3.5 py-3">
        {role.isProtected ? (
          <span className="text-xs text-disabled">内置角色不可操作</span>
        ) : (
          <div className="flex gap-2">
            {role.status === "active" ? (
              <Button
                aria-label={`停用${role.name}`}
                disabled={isPending}
                onClick={onDisable}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Ban className="size-4" />
                停用
              </Button>
            ) : null}
            <Button
              aria-label={`删除${role.name}`}
              disabled={isPending}
              onClick={onDelete}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Trash2 className="size-4" />
              删除
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

function NewRoleDrawer({
  onClose,
  open,
}: {
  onClose: () => void;
  open: boolean;
}) {
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [applicationCode, setApplicationCode] = useState("admin");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [formError, setFormError] = useState("");

  const createMutation = useMutation({
    mutationFn: (payload: RoleCreateRequest) => createAdminRole(payload),
    onError: (error) => {
      setFormError(toErrorMessage(error, "创建角色失败，请稍后重试"));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminRoleKeys.all });
      onClose();
    },
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      setApplicationCode("admin");
      setCode("");
      setName("");
      setFormError("");
      setTimeout(() => nameRef.current?.focus(), 220);
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createMutation.isPending) return;

    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("请输入角色名称。");
      return;
    }
    if (!RoleCreateRequestSchema.shape.code.safeParse(trimmedCode).success) {
      setFormError(
        "角色 code 需以小写字母开头，只能包含小写字母、数字、_、:、-。",
      );
      return;
    }

    setFormError("");
    createMutation.mutate({
      applicationCode,
      code: trimmedCode,
      name: trimmedName,
    });
  }

  return (
    <dialog
      aria-labelledby="new-role-title"
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
            <h2 className="text-base font-semibold" id="new-role-title">
              新建角色
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              角色按应用维度隔离，创建后立即出现在列表中。
            </p>
          </div>
          <Button
            aria-label="关闭新建角色抽屉"
            className="ml-auto p-0"
            onClick={onClose}
            size="icon"
            type="button"
            variant="secondary"
          >
            <X className="size-4" />
          </Button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex-1 overflow-y-auto p-5">
            <label
              className="mb-1.5 block text-[0.6875rem] font-semibold text-muted"
              htmlFor="roleName"
            >
              角色名称
            </label>
            <Input
              autoComplete="off"
              className="bg-background text-xs"
              id="roleName"
              maxLength={128}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：内容审核"
              ref={nameRef}
              value={name}
            />

            <label
              className="mt-2.5 mb-1.5 block text-[0.6875rem] font-semibold text-muted"
              htmlFor="roleCode"
            >
              角色 code
            </label>
            <Input
              autoComplete="off"
              className="bg-background text-xs"
              id="roleCode"
              maxLength={64}
              onChange={(event) => setCode(event.target.value)}
              placeholder="例如：content_reviewer"
              value={code}
            />
            <p className="mt-1.5 text-[0.6875rem] text-disabled">
              小写字母开头，只能包含小写字母、数字、_、:、-。
            </p>

            <label
              className="mt-2.5 mb-1.5 block text-[0.6875rem] font-semibold text-muted"
              htmlFor="roleApplication"
            >
              所属应用
            </label>
            <div className="relative">
              <select
                className="h-9 w-full appearance-none rounded-md border border-border bg-background pr-8 pl-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-focus"
                id="roleApplication"
                onChange={(event) => setApplicationCode(event.target.value)}
                value={applicationCode}
              >
                <option value="admin">admin</option>
                <option value="web">web</option>
              </select>
            </div>

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
              onClick={onClose}
              size="sm"
              type="button"
              variant="secondary"
            >
              取消
            </Button>
            <Button
              className="flex-1"
              disabled={createMutation.isPending}
              size="sm"
              type="submit"
            >
              {createMutation.isPending ? "创建中…" : "创建角色"}
            </Button>
          </footer>
        </form>
      </aside>
    </dialog>
  );
}
