"use client";
import { useQuery } from "@tanstack/react-query";
import { Activity, Bot, MessageSquareText, Users } from "lucide-react";
import Link from "next/link";
import { adminOverviewQueryOptions } from "@/src/api/operations.query";
const number = new Intl.NumberFormat("zh-CN");
const dateTime = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "short",
  timeStyle: "short",
  hour12: false,
});
export function OverviewPage() {
  const query = useQuery(adminOverviewQueryOptions());
  const data = query.data;
  const metrics = data
    ? [
        {
          label: "用户",
          value: data.users.total,
          detail: `今日新增 ${data.users.createdToday} · 活跃 ${data.users.activeToday}`,
          icon: Users,
        },
        {
          label: "朋友",
          value: data.agents.system + data.agents.user,
          detail: `系统 ${data.agents.system} · 用户 ${data.agents.user} · 群聊 ${data.conversations.group}`,
          icon: Bot,
        },
        {
          label: "消息",
          value: data.messages.total,
          detail: `今日用户消息 ${data.messages.today}`,
          icon: MessageSquareText,
        },
        {
          label: "AI 调用",
          value: data.aiCalls.total,
          detail: `今日 ${data.aiCalls.today} · 失败率 ${(data.aiCalls.failureRateToday * 100).toFixed(1)}%`,
          icon: Activity,
        },
      ]
    : [];
  return (
    <section>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">数据概览</h1>
        <p className="mt-1 text-sm text-muted">
          今日按 Asia/Shanghai 自然日统计
        </p>
      </header>
      {query.isPending ? (
        <p className="text-sm text-muted">正在加载运营数据</p>
      ) : query.isError ? (
        <p className="text-sm text-danger">运营数据加载失败</p>
      ) : (
        <>
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, detail, icon: Icon }) => (
              <article className="bg-background p-5" key={label}>
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Icon className="size-4" />
                  {label}
                </div>
                <strong className="mt-4 block text-3xl font-semibold tabular-nums">
                  {number.format(value)}
                </strong>
                <p className="mt-2 text-xs text-muted">{detail}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 border-t border-border pt-5">
            <h2 className="text-sm font-semibold">Token 用量</h2>
            <div className="mt-3 flex flex-wrap gap-8">
              <p>
                <span className="text-xs text-muted">累计</span>
                <strong className="ml-3 tabular-nums">
                  {number.format(data!.tokens.total)}
                </strong>
              </p>
              <p>
                <span className="text-xs text-muted">今日</span>
                <strong className="ml-3 tabular-nums">
                  {number.format(data!.tokens.today)}
                </strong>
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-8 xl:grid-cols-2">
            <section className="min-w-0">
              <h2 className="text-sm font-semibold">最近 7 天趋势</h2>
              <div className="admin-table-scroll admin-table-scroll-compact mt-3">
                <table className="w-full min-w-[36rem] table-fixed text-left text-xs">
                  <colgroup>
                    <col className="w-36" />
                    <col className="w-36" />
                    <col className="w-36" />
                    <col className="w-36" />
                  </colgroup>
                  <thead className="text-muted">
                    <tr>
                      <th className="px-3 py-3 font-medium">日期</th>
                      <th className="px-3 py-3 font-medium">用户消息</th>
                      <th className="px-3 py-3 font-medium">AI 调用</th>
                      <th className="px-3 py-3 font-medium">Token</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.trend.map((item) => (
                      <tr className="border-t border-border" key={item.date}>
                        <td className="whitespace-nowrap px-3 py-3">
                          {item.date}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                          {number.format(item.messageCount)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                          {number.format(item.aiCallCount)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                          {number.format(item.totalTokens)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="min-w-0">
              <h2 className="text-sm font-semibold">Token 使用排行</h2>
              <div className="mt-3 grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs text-muted">用户</h3>
                  <ol className="mt-2 divide-y divide-border border-t border-border">
                    {data!.topUsers.length === 0 ? (
                      <li className="py-3 text-xs text-muted">暂无用量</li>
                    ) : (
                      data!.topUsers.map((item) => (
                        <li
                          className="flex items-center gap-3 py-3 text-xs"
                          key={item.userId}
                        >
                          <Link
                            className="min-w-0 flex-1 truncate hover:underline"
                            href={`/users?usage=${encodeURIComponent(item.userId)}`}
                          >
                            {item.displayName}
                          </Link>
                          <span className="tabular-nums">
                            {number.format(item.totalTokens)}
                          </span>
                        </li>
                      ))
                    )}
                  </ol>
                </div>
                <div>
                  <h3 className="text-xs text-muted">朋友</h3>
                  <ol className="mt-2 divide-y divide-border border-t border-border">
                    {data!.topAgents.length === 0 ? (
                      <li className="py-3 text-xs text-muted">暂无用量</li>
                    ) : (
                      data!.topAgents.map((item) => (
                        <li
                          className="flex items-center gap-3 py-3 text-xs"
                          key={item.agentId}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {item.name}
                          </span>
                          <span className="tabular-nums">
                            {number.format(item.totalTokens)}
                          </span>
                        </li>
                      ))
                    )}
                  </ol>
                </div>
              </div>
            </section>
          </div>
          <section className="mt-8 border-t border-border pt-5">
            <h2 className="text-sm font-semibold">最近失败调用</h2>
            {data!.recentFailures.length === 0 ? (
              <p className="mt-3 text-xs text-muted">暂无失败调用</p>
            ) : (
              <div className="admin-table-scroll admin-table-scroll-compact mt-3">
                <table className="w-full min-w-[76rem] table-fixed text-left text-xs">
                  <colgroup>
                    <col className="w-40" />
                    <col className="w-48" />
                    <col className="w-64" />
                    <col className="w-48" />
                    <col className="w-72" />
                  </colgroup>
                  <thead className="text-muted">
                    <tr>
                      <th className="px-3 py-3 font-medium">时间</th>
                      <th className="px-3 py-3 font-medium">场景</th>
                      <th className="px-3 py-3 font-medium">Provider / 模型</th>
                      <th className="px-3 py-3 font-medium">错误</th>
                      <th className="px-3 py-3 font-medium">requestId</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.recentFailures.map((item) => (
                      <tr className="border-t border-border" key={item.id}>
                        <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                          {dateTime.format(item.startedAtMs)}
                        </td>
                        <td
                          className="truncate px-3 py-3"
                          title={item.scenario}
                        >
                          {item.scenario}
                        </td>
                        <td className="truncate px-3 py-3">
                          {item.providerName} / {item.model}
                        </td>
                        <td
                          className="truncate px-3 py-3"
                          title={item.errorCode ?? "未知"}
                        >
                          {item.errorCode ?? "未知"}
                        </td>
                        <td
                          className="truncate px-3 py-3 font-mono"
                          title={item.requestId}
                        >
                          {item.requestId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
