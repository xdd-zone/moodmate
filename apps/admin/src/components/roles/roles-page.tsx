"use client";

import { type Role, RoleCreateRequestSchema } from "@repo/contracts";
import { Alert } from "@repo/ui/alert";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Field, FieldLabel } from "@repo/ui/field";
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
import { useState } from "react";
import type { FormEvent } from "react";

import {
  createAdminRole,
  deleteAdminRole,
  disableAdminRole,
} from "@/src/api/roles.api";
import { adminRoleKeys, adminRolesQueryOptions } from "@/src/api/roles.query";
import { HttpRequestError } from "@/src/lib/http";

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
    <section className="mx-auto grid max-w-6xl gap-8 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
      <div>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary-strong">权限基础</p>
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
          <Alert className="mb-4" variant="danger">
            {getErrorMessage(rolesQuery.error)}
          </Alert>
        ) : null}
        {message ? (
          <Alert className="mb-4" variant="success">
            {message}
          </Alert>
        ) : null}
        {actionError ? (
          <Alert className="mb-4" variant="danger">
            {actionError}
          </Alert>
        ) : null}

        <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>应用</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
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
            </TableBody>
          </Table>
          {!rolesQuery.isPending && !rolesQuery.data?.items.length ? (
            <p className="border-x border-b border-border px-3 py-8 text-sm text-muted">
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
            <RoleField
              id="applicationCode"
              label="应用 code"
              placeholder="admin"
            />
            <RoleField
              id="code"
              label="角色 code"
              placeholder="admin_operator"
            />
            <RoleField
              id="name"
              label="显示名称"
              placeholder="Admin Operator"
            />
            {formError ? <Alert variant="danger">{formError}</Alert> : null}
            <Button disabled={createMutation.isPending} type="submit">
              {createMutation.isPending ? "正在创建" : "创建角色"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
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
    <TableRow>
      <TableCell>{role.applicationCode}</TableCell>
      <TableCell>
        <div className="font-medium">{role.name}</div>
        <div className="mt-1 break-all text-xs text-muted">{role.code}</div>
      </TableCell>
      <TableCell>
        <Badge variant={role.status === "active" ? "default" : "outline"}>
          {statusLabels[role.status]}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
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
      </TableCell>
    </TableRow>
  );
}

function RoleField({
  id,
  label,
  placeholder,
}: {
  id: string;
  label: string;
  placeholder: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} name={id} placeholder={placeholder} required />
    </Field>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof HttpRequestError
    ? error.message
    : error instanceof Error
      ? error.message
      : "角色请求失败，请稍后重试";
}
