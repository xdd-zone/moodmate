"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminMessageFeedbackListItem,
  AdminMessageFeedbackStatus,
} from "@repo/contracts";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/table";
import { X } from "lucide-react";
import {
  adminFeedbackDetailQueryOptions,
  adminFeedbacksQueryOptions,
  adminFeedbackStatusMutationOptions,
} from "@/src/api/operations.query";
import { Drawer } from "@/src/components/ui/drawer";
const time = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  hour12: false,
});
export function FeedbackPage() {
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState<AdminMessageFeedbackStatus | "">("");
  const [rating, setRating] = useState<"positive" | "negative" | "">("");
  const queryClient = useQueryClient();
  const list = useQuery(
    adminFeedbacksQueryOptions({
      page: 1,
      pageSize: 50,
      ...(status ? { status } : {}),
      ...(rating ? { rating } : {}),
    }),
  );
  const detail = useQuery(adminFeedbackDetailQueryOptions(selected));
  const updateStatus = useMutation(
    adminFeedbackStatusMutationOptions(queryClient),
  );

  function toggleStatus(item: AdminMessageFeedbackListItem) {
    updateStatus.mutate({
      id: item.id,
      payload: {
        status: item.status === "pending" ? "processed" : "pending",
      },
    });
  }
  return (
    <section>
      <header className="mb-5">
        <h1 className="text-2xl font-semibold">消息反馈</h1>
        <p className="mt-1 text-sm text-muted">
          列表不读取聊天正文；打开详情后记录敏感访问审计
        </p>
      </header>
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          aria-label="反馈状态筛选"
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          onChange={(event) => {
            const value = event.currentTarget.value;
            setStatus(
              value === "pending" || value === "processed" ? value : "",
            );
          }}
          value={status}
        >
          <option value="">全部状态</option>
          <option value="pending">待处理</option>
          <option value="processed">已处理</option>
        </select>
        <select
          aria-label="反馈评分筛选"
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          onChange={(event) => {
            const value = event.currentTarget.value;
            setRating(
              value === "positive" || value === "negative" ? value : "",
            );
          }}
          value={rating}
        >
          <option value="">全部评分</option>
          <option value="positive">喜欢</option>
          <option value="negative">不喜欢</option>
        </select>
      </div>
      <Table
        className="min-w-[92rem] table-fixed"
        containerClassName="admin-table-scroll"
      >
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">时间</TableHead>
            <TableHead className="w-40">用户</TableHead>
            <TableHead className="w-40">朋友</TableHead>
            <TableHead className="w-24">评分</TableHead>
            <TableHead className="w-56">原因</TableHead>
            <TableHead className="w-72">用户备注</TableHead>
            <TableHead className="w-32">处理状态</TableHead>
            <TableHead className="w-64">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.isPending ? (
            <TableRow>
              <TableCell className="py-12 text-center text-muted" colSpan={8}>
                正在加载反馈
              </TableCell>
            </TableRow>
          ) : list.isError ? (
            <TableRow>
              <TableCell className="py-12 text-center text-danger" colSpan={8}>
                反馈列表加载失败
              </TableCell>
            </TableRow>
          ) : list.data.items.length === 0 ? (
            <TableRow>
              <TableCell className="py-12 text-center text-muted" colSpan={8}>
                暂无反馈
              </TableCell>
            </TableRow>
          ) : (
            list.data.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {time.format(item.submittedAtMs)}
                </TableCell>
                <TableCell className="truncate" title={item.userDisplayName}>
                  {item.userDisplayName}
                </TableCell>
                <TableCell className="truncate" title={item.agentName}>
                  {item.agentName}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {item.rating === "positive" ? "喜欢" : "不喜欢"}
                </TableCell>
                <TableCell className="break-words">
                  {item.reason ?? "未填写"}
                </TableCell>
                <TableCell className="break-words">
                  {item.note ?? "未填写"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant="secondary">
                    {item.status === "pending" ? "待处理" : "已处理"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setSelected(item.id)}
                      size="sm"
                      variant="secondary"
                    >
                      查看详情
                    </Button>
                    <Button
                      disabled={
                        updateStatus.isPending &&
                        updateStatus.variables?.id === item.id
                      }
                      onClick={() => toggleStatus(item)}
                      size="sm"
                      variant="ghost"
                    >
                      {item.status === "pending" ? "标记已处理" : "重新打开"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <Drawer
        maxWidth="max-w-lg"
        onClose={() => setSelected("")}
        open={Boolean(selected)}
      >
        <div className="flex items-center border-b border-border p-6">
          <h2 className="text-lg font-semibold">反馈详情</h2>
          <Button
            aria-label="关闭反馈详情"
            className="ml-auto"
            onClick={() => setSelected("")}
            size="icon"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {detail.isPending ? (
            <p className="mt-6 text-sm text-muted">正在读取关联消息</p>
          ) : detail.data ? (
            <div className="mt-6 space-y-6">
              <section>
                <h3 className="text-xs text-muted">处理状态</h3>
                <div className="mt-2 flex items-center gap-3">
                  <Badge variant="secondary">
                    {detail.data.feedback.status === "pending"
                      ? "待处理"
                      : "已处理"}
                  </Badge>
                  <Button
                    disabled={updateStatus.isPending}
                    onClick={() => toggleStatus(detail.data.feedback)}
                    size="sm"
                    variant="secondary"
                  >
                    {detail.data.feedback.status === "pending"
                      ? "标记已处理"
                      : "重新打开"}
                  </Button>
                </div>
              </section>
              <section>
                <h3 className="text-xs text-muted">用户消息</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {detail.data.userMessage.content}
                </p>
              </section>
              <section>
                <h3 className="text-xs text-muted">AI 回复</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {detail.data.assistantMessage.content}
                </p>
              </section>
              <section>
                <h3 className="text-xs text-muted">用户备注</h3>
                <p className="mt-2 text-sm">
                  {detail.data.feedback.note ?? "未填写"}
                </p>
              </section>
            </div>
          ) : (
            <p className="mt-6 text-sm text-danger">详情读取失败</p>
          )}
        </div>
      </Drawer>
    </section>
  );
}
