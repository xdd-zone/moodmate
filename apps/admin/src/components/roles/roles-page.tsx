"use client";

import { type Role, RoleCreateRequestSchema } from "@repo/contracts";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";

import {
  createAdminRole,
  deleteAdminRole,
  disableAdminRole,
} from "@/src/api/roles.api";
import { adminRoleKeys, adminRolesQueryOptions } from "@/src/api/roles.query";
import { HttpRequestError } from "@/src/lib/http";

const inputClassName =
  "min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const statusLabels = {
  active: "启用",
  disabled: "已禁用",
  deleted: "已删除",
} as const;

export function RolesPage() {
  const queryClient = useQueryClient();
  const rolesQuery = useQuery(adminRolesQueryOptions());
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async (input: {
      action: "create" | "delete" | "disable";
      payload?: Role;
    }) => {
      if (input.action === "create") {
        throw new Error("创建操作需要单独提交");
      }

      if (!input.payload) {
        throw new Error("角色数据缺失");
      }

      return input.action === "disable"
        ? disableAdminRole(input.payload.id)
        : deleteAdminRole(input.payload.id);
    },
    onSuccess: (_, variables) => {
      setActionError(null);
      setMessage(variables.action === "disable" ? "角色已禁用" : "角色已删除");
      void queryClient.invalidateQueries({ queryKey: adminRoleKeys.all });
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });
  const createMutation = useMutation({
    mutationFn: createAdminRole,
    onSuccess: () => {
      setMessage("角色已创建");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: adminRoleKeys.all });
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setMessage(null);
    const formData = new FormData(event.currentTarget);
    const result = RoleCreateRequestSchema.safeParse({
      applicationCode: formData.get("applicationCode"),
      code: formData.get("code"),
      name: formData.get("name"),
    });

    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? "角色参数无效");
      return;
    }

    createMutation.mutate(result.data);
    event.currentTarget.reset();
  }

  return (
    <main className="min-h-svh px-5 py-6 text-foreground md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-border py-4">
          <Link className="text-sm font-semibold" href="/">
            moodmate
          </Link>
          <Badge variant="outline">角色管理</Badge>
          <Button asChild className="ml-auto" size="sm" variant="outline">
            <Link href="/">返回首页</Link>
          </Button>
        </header>

        <section className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
          <div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-primary-strong">
                  权限基础
                </p>
                <h1 className="mt-2 text-2xl font-semibold">角色</h1>
              </div>
              <Button
                disabled={rolesQuery.isFetching}
                onClick={() => rolesQuery.refetch()}
                size="sm"
                variant="secondary"
              >
                重新读取
              </Button>
            </div>

            {rolesQuery.isError ? (
              <p
                className="border-l-2 border-danger pl-3 text-sm text-danger"
                role="alert"
              >
                {getErrorMessage(rolesQuery.error)}
              </p>
            ) : null}
            {message ? (
              <p className="mb-4 text-sm text-primary-strong">{message}</p>
            ) : null}
            {actionError ? (
              <p className="mb-4 text-sm text-danger" role="alert">
                {actionError}
              </p>
            ) : null}

            <div className="overflow-x-auto border-y border-border">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-border text-xs text-muted">
                  <tr>
                    <th className="px-3 py-3 font-medium">应用</th>
                    <th className="px-3 py-3 font-medium">角色</th>
                    <th className="px-3 py-3 font-medium">状态</th>
                    <th className="px-3 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(rolesQuery.data?.items ?? []).map((role) => (
                    <RoleRow
                      key={role.id}
                      isPending={mutation.isPending}
                      onAction={(action) =>
                        mutation.mutate({ action, payload: role })
                      }
                      role={role}
                    />
                  ))}
                </tbody>
              </table>
              {!rolesQuery.isPending && !rolesQuery.data?.items.length ? (
                <p className="px-3 py-8 text-sm text-muted">
                  当前没有可管理的角色。
                </p>
              ) : null}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>创建角色</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleCreate}>
                <Field
                  id="applicationCode"
                  label="应用 code"
                  placeholder="admin"
                />
                <Field
                  id="code"
                  label="角色 code"
                  placeholder="admin_operator"
                />
                <Field
                  id="name"
                  label="显示名称"
                  placeholder="Admin Operator"
                />
                {formError ? (
                  <p className="text-sm text-danger" role="alert">
                    {formError}
                  </p>
                ) : null}
                <Button disabled={createMutation.isPending} type="submit">
                  {createMutation.isPending ? "正在创建" : "创建角色"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function RoleRow({
  isPending,
  onAction,
  role,
}: {
  isPending: boolean;
  onAction: (action: "delete" | "disable") => void;
  role: Role;
}) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-4 align-top">{role.applicationCode}</td>
      <td className="px-3 py-4 align-top">
        <div className="font-medium">{role.name}</div>
        <div className="mt-1 break-all text-xs text-muted">{role.code}</div>
      </td>
      <td className="px-3 py-4 align-top">
        <Badge variant={role.status === "active" ? "default" : "outline"}>
          {statusLabels[role.status]}
        </Badge>
      </td>
      <td className="px-3 py-4 text-right align-top">
        {role.isProtected ? (
          <span className="text-xs text-muted">内建角色</span>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            {role.status === "active" ? (
              <Button
                disabled={isPending}
                onClick={() => onAction("disable")}
                size="sm"
                variant="secondary"
              >
                禁用
              </Button>
            ) : null}
            <Button
              disabled={isPending}
              onClick={() => onAction("delete")}
              size="sm"
              variant="danger"
            >
              删除
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

function Field({
  id,
  label,
  placeholder,
}: {
  id: string;
  label: string;
  placeholder: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium" htmlFor={id}>
      {label}
      <input
        className={inputClassName}
        id={id}
        name={id}
        placeholder={placeholder}
        required
      />
    </label>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof HttpRequestError
    ? error.message
    : error instanceof Error
      ? error.message
      : "角色请求失败，请稍后重试";
}
