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
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table className="min-w-[58rem]">
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>用户</TableHead>
              <TableHead>朋友</TableHead>
              <TableHead>评分</TableHead>
              <TableHead>原因</TableHead>
              <TableHead>用户备注</TableHead>
              <TableHead>处理状态</TableHead>
              <TableHead />
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
                <TableCell
                  className="py-12 text-center text-danger"
                  colSpan={8}
                >
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
                  <TableCell>{time.format(item.submittedAtMs)}</TableCell>
                  <TableCell>{item.userDisplayName}</TableCell>
                  <TableCell>{item.agentName}</TableCell>
                  <TableCell>
                    {item.rating === "positive" ? "喜欢" : "不喜欢"}
                  </TableCell>
                  <TableCell>{item.reason ?? "未填写"}</TableCell>
                  <TableCell>{item.note ?? "未填写"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {item.status === "pending" ? "待处理" : "已处理"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
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
      </div>
      {selected ? (
        <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto border-l border-border bg-background p-6 shadow-xl">
          <div className="flex items-center">
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
        </aside>
      ) : null}
    </section>
  );
}
