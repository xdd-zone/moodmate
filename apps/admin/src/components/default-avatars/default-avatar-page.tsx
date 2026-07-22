"use client";

import {
  DEFAULT_AVATAR_MAX_BYTES,
  DefaultAvatarContentTypeSchema,
  type AdminDefaultAvatarVersion,
} from "@repo/contracts";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ImageOff, RefreshCw, Upload } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

import {
  adminCurrentDefaultAvatarQueryOptions,
  adminDefaultAvatarHistoryQueryOptions,
  setAdminCurrentDefaultAvatarMutationOptions,
  uploadAdminDefaultAvatarMutationOptions,
} from "@/src/api/default-avatars.query";

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function formatFileSize(bytes: number): string {
  return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KiB`;
}

function getAvatarImagePath(key: string): string {
  const params = new URLSearchParams({ key });
  return `/api/default-avatars/image?${params.toString()}`;
}

export function DefaultAvatarPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<"error" | "success">(
    "success",
  );
  const currentQuery = useQuery(adminCurrentDefaultAvatarQueryOptions());
  const historyQuery = useQuery(adminDefaultAvatarHistoryQueryOptions());
  const uploadMutation = useMutation(
    uploadAdminDefaultAvatarMutationOptions(queryClient),
  );
  const setCurrentMutation = useMutation(
    setAdminCurrentDefaultAvatarMutationOptions(queryClient),
  );

  const current = currentQuery.data?.version ?? null;
  const history = historyQuery.data?.items ?? [];
  const isLoading = currentQuery.isPending || historyQuery.isPending;
  const queryError = currentQuery.error ?? historyQuery.error;

  function setSuccess(message: string) {
    setFeedbackKind("success");
    setFeedback(message);
  }

  function setError(message: string) {
    setFeedbackKind("error");
    setFeedback(message);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    if (!DefaultAvatarContentTypeSchema.safeParse(file.type).success) {
      setError("头像只支持 JPG、PNG 或 WebP 文件");
      event.currentTarget.value = "";
      return;
    }
    if (file.size <= 0) {
      setError("头像文件不能为空");
      event.currentTarget.value = "";
      return;
    }
    if (file.size > DEFAULT_AVATAR_MAX_BYTES) {
      setError("头像文件不能超过 2 MiB");
      event.currentTarget.value = "";
      return;
    }

    setFeedback("");
    uploadMutation.mutate(file, {
      onError: (error) => {
        setError(toErrorMessage(error, "上传默认头像失败，请稍后重试"));
      },
      onSettled: () => {
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      onSuccess: () => {
        setSuccess("默认头像已上传并设为当前版本");
      },
    });
  }

  function handleSetCurrent(version: AdminDefaultAvatarVersion) {
    if (version.isCurrent || setCurrentMutation.isPending) return;

    setFeedback("");
    setCurrentMutation.mutate(version.id, {
      onError: (error) => {
        setError(toErrorMessage(error, "切换默认头像失败，请稍后重试"));
      },
      onSuccess: () => {
        setSuccess(`“${version.fileName}”已设为当前默认头像`);
      },
    });
  }

  async function retryQueries() {
    setFeedback("");
    await Promise.all([currentQuery.refetch(), historyQuery.refetch()]);
  }

  return (
    <section className="w-full">
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">默认头像</h1>
          <p className="mt-1 text-xs leading-6 text-muted sm:text-sm">
            管理未设置个人头像时使用的默认图片
          </p>
        </div>
      </div>

      {feedback ? (
        <p
          className={`mb-4 rounded-md border bg-surface px-4 py-3 text-xs ${feedbackKind === "error" ? "border-danger text-danger" : "border-border text-foreground"}`}
          role={feedbackKind === "error" ? "alert" : "status"}
        >
          {feedback}
        </p>
      ) : null}

      {queryError ? (
        <Card className="flex flex-col items-start gap-3 p-5">
          <p className="text-sm text-danger" role="alert">
            {toErrorMessage(queryError, "默认头像信息加载失败，请稍后重试")}
          </p>
          <Button
            onClick={() => void retryQueries()}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCw className="size-4" />
            重试
          </Button>
        </Card>
      ) : isLoading ? (
        <Card className="p-5">
          <p className="text-sm text-muted">正在加载默认头像…</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">当前版本</CardTitle>
                <CardDescription>
                  新上传的图片会立即成为当前版本
                </CardDescription>
              </CardHeader>
              <CardContent>
                {current ? (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Image
                      alt={`当前默认头像：${current.fileName}`}
                      className="size-28 shrink-0 rounded-md border border-border bg-background object-cover"
                      height={112}
                      src={getAvatarImagePath(current.key)}
                      unoptimized
                      width={112}
                    />
                    <div className="min-w-0 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">
                          {current.fileName}
                        </p>
                        <Badge variant="secondary">当前</Badge>
                      </div>
                      <p className="break-all text-muted">{current.key}</p>
                      <p className="text-muted">
                        {current.contentType} ·{" "}
                        {formatFileSize(current.sizeBytes)}
                      </p>
                      <p className="text-muted">
                        上传于 {formatTime(current.createdAtMs)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-28 items-center gap-3 text-muted">
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-md border border-dashed border-border">
                      <ImageOff aria-hidden="true" className="size-5" />
                    </span>
                    <p className="text-sm">尚未上传默认头像</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">上传新版本</CardTitle>
                <CardDescription>
                  支持 JPG、PNG、WebP，最大 2 MiB
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  asChild
                  className="w-full sm:w-auto"
                  size="sm"
                  variant="secondary"
                >
                  <label>
                    <Upload aria-hidden="true" className="size-4" />
                    {uploadMutation.isPending ? "正在上传" : "选择图片"}
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={uploadMutation.isPending}
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      type="file"
                    />
                  </label>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="mt-5">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-base font-semibold">历史版本</h2>
                <p className="mt-0.5 text-xs text-muted">按上传时间倒序</p>
              </div>
              <Badge className="ml-auto" variant="outline">
                {history.length} 个版本
              </Badge>
            </div>

            <Card className="overflow-hidden">
              {history.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[44rem] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["头像", "文件", "类型与大小", "上传时间", "操作"].map(
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
                      {history.map((version) => (
                        <DefaultAvatarVersionRow
                          isBusy={setCurrentMutation.isPending}
                          isPending={
                            setCurrentMutation.isPending &&
                            setCurrentMutation.variables === version.id
                          }
                          key={version.id}
                          onSetCurrent={() => handleSetCurrent(version)}
                          version={version}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-5 py-10 text-center text-sm text-muted">
                  暂无历史版本，请先上传一张默认头像
                </p>
              )}
            </Card>
          </div>
        </>
      )}
    </section>
  );
}

function DefaultAvatarVersionRow({
  isBusy,
  isPending,
  onSetCurrent,
  version,
}: {
  isBusy: boolean;
  isPending: boolean;
  onSetCurrent: () => void;
  version: AdminDefaultAvatarVersion;
}) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3.5 py-3">
        <Image
          alt=""
          className="size-11 rounded-md border border-border bg-background object-cover"
          height={44}
          src={getAvatarImagePath(version.key)}
          unoptimized
          width={44}
        />
      </td>
      <td className="max-w-56 px-3.5 py-3">
        <p className="truncate text-xs font-semibold">{version.fileName}</p>
        <p className="mt-1 truncate text-[0.6875rem] text-muted">
          {version.key}
        </p>
      </td>
      <td className="px-3.5 py-3 text-xs text-muted">
        <p>{version.contentType}</p>
        <p className="mt-1">{formatFileSize(version.sizeBytes)}</p>
      </td>
      <td className="px-3.5 py-3 text-xs text-muted tabular-nums">
        {formatTime(version.createdAtMs)}
      </td>
      <td className="px-3.5 py-3">
        {version.isCurrent ? (
          <Badge variant="secondary">
            <Check aria-hidden="true" className="size-3" />
            当前版本
          </Badge>
        ) : (
          <Button
            disabled={isBusy}
            onClick={onSetCurrent}
            size="sm"
            type="button"
            variant="outline"
          >
            {isPending ? "正在切换" : "设为当前"}
          </Button>
        )}
      </td>
    </tr>
  );
}
