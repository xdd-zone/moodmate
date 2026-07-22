"use client";

import {
  PERSONAL_AVATAR_MAX_BYTES,
  PersonalAvatarContentTypeSchema,
  type AdminProfile,
} from "@repo/contracts";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Clock3,
  Mail,
  RotateCcw,
  Upload,
  UserRound,
} from "lucide-react";
import { useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

import {
  adminProfileQueryOptions,
  uploadAdminProfileAvatarMutationOptions,
} from "@/src/api/profile.query";
import { adminSessionQueryOptions } from "@/src/auth/session.query";

import { AdminAvatar } from "./admin-avatar";

const STATUS_LABELS: Record<AdminProfile["status"], string> = {
  active: "正常",
  deleted: "已删除",
  suspended: "已停用",
};

function formatTime(value: number | null): string {
  if (value === null) return "暂无记录";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileQuery = useQuery(adminProfileQueryOptions());
  const sessionQuery = useQuery(adminSessionQueryOptions());
  const uploadMutation = useMutation(
    uploadAdminProfileAvatarMutationOptions(queryClient),
  );
  const [validationError, setValidationError] = useState("");

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    uploadMutation.reset();
    setValidationError("");

    if (!file) return;

    if (!PersonalAvatarContentTypeSchema.safeParse(file.type).success) {
      setValidationError("头像只支持 JPG、PNG 或 WebP 文件");
      return;
    }

    if (file.size <= 0) {
      setValidationError("头像文件不能为空");
      return;
    }

    if (file.size > PERSONAL_AVATAR_MAX_BYTES) {
      setValidationError("头像文件不能超过 2 MiB");
      return;
    }

    uploadMutation.mutate(file);
  }

  if (profileQuery.isPending || sessionQuery.isPending) {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted">正在加载管理员资料…</p>
      </Card>
    );
  }

  if (profileQuery.isError || sessionQuery.isError) {
    const error = profileQuery.error ?? sessionQuery.error;

    return (
      <Card className="flex flex-col items-start gap-3 p-5">
        <p className="text-sm text-danger" role="alert">
          {toErrorMessage(error, "管理员资料加载失败，请稍后重试")}
        </p>
        <Button
          onClick={() => {
            void Promise.all([profileQuery.refetch(), sessionQuery.refetch()]);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <RotateCcw className="size-4" />
          重试
        </Button>
      </Card>
    );
  }

  const profile = profileQuery.data;
  const session = sessionQuery.data;
  const uploadError = validationError
    ? validationError
    : uploadMutation.isError
      ? toErrorMessage(uploadMutation.error, "个人头像上传失败，请稍后重试")
      : "";

  return (
    <section className="w-full">
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">管理员资料</h1>
          <p className="mt-1 text-xs leading-6 text-muted sm:text-sm">
            查看当前账号和会话信息，更新个人头像
          </p>
        </div>
        <Badge
          className="ml-auto"
          variant={profile.status === "active" ? "secondary" : "outline"}
        >
          {STATUS_LABELS[profile.status]}
        </Badge>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
        <Card className="p-5">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center lg:flex-col lg:items-start">
            <AdminAvatar
              alt={`${profile.displayName}的头像`}
              avatar={profile.avatar}
              className="size-24 text-2xl font-semibold ring-1 ring-border"
              displayName={profile.displayName}
            />
            <div className="min-w-0">
              <p className="text-base font-semibold">{profile.displayName}</p>
              <p className="mt-1 break-all text-xs text-muted">
                {profile.email}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.roles.map((role) => (
                  <Badge key={role} variant="outline">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <input
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
              ref={fileInputRef}
              type="file"
            />
            <Button
              disabled={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              type="button"
            >
              <Upload className="size-4" />
              {uploadMutation.isPending ? "正在上传" : "选择并上传"}
            </Button>
            <p className="mt-3 text-xs leading-5 text-muted">
              支持 JPG、PNG 和 WebP，文件不能超过 2 MiB
            </p>
            {uploadError ? (
              <p className="mt-3 text-xs text-danger" role="alert">
                {uploadError}
              </p>
            ) : uploadMutation.isSuccess ? (
              <p className="mt-3 text-xs text-success" role="status">
                个人头像已更新
              </p>
            ) : null}
          </div>
        </Card>

        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">账号信息</h2>
            </div>
            <dl className="divide-y divide-border">
              <InfoRow icon={<UserRound className="size-4" />} label="用户 ID">
                {profile.id}
              </InfoRow>
              <InfoRow icon={<Mail className="size-4" />} label="主邮箱">
                {profile.email}
              </InfoRow>
              <InfoRow
                icon={<CalendarClock className="size-4" />}
                label="创建时间"
              >
                {formatTime(profile.createdAtMs)}
              </InfoRow>
              <InfoRow icon={<Clock3 className="size-4" />} label="最近登录">
                {formatTime(profile.lastLoginAtMs)}
              </InfoRow>
            </dl>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">当前会话</h2>
            </div>
            <dl className="divide-y divide-border">
              <InfoRow label="Session ID">{session.sessionId}</InfoRow>
              <InfoRow label="到期时间">
                {formatTime(session.expiresAtMs)}
              </InfoRow>
            </dl>
          </Card>
        </div>
      </div>
    </section>
  );
}

function InfoRow({
  children,
  icon,
  label,
}: {
  children: ReactNode;
  icon?: ReactNode;
  label: string;
}) {
  return (
    <div className="grid gap-1.5 px-5 py-3.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
      <dt className="flex items-center gap-2 text-xs text-muted">
        {icon}
        {label}
      </dt>
      <dd className="break-all text-xs font-medium tabular-nums sm:text-right">
        {children}
      </dd>
    </div>
  );
}
