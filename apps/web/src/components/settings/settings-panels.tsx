"use client";

import type { WebSession, WebUserProfile } from "@repo/contracts";
import { Button } from "@repo/ui/button";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { LogOut, Trash2 } from "lucide-react";
import { useState } from "react";

import { clearLocalLlmConfig } from "@/src/auth/local-llm-config";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function PanelShell({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-7 sm:px-6 sm:py-10">
      <div className="border-b border-border pb-5">
        <h2 className="text-xl font-semibold">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="break-words sm:text-right">{value}</dd>
    </div>
  );
}

export function ProfilePanel({
  onLogout,
  profile,
  session,
}: {
  onLogout: () => void;
  profile: WebUserProfile;
  session: WebSession;
}) {
  return (
    <PanelShell description="当前登录信息" title="个人资料">
      <dl className="divide-y divide-border py-3 text-sm">
        <InfoRow label="昵称" value={profile.displayName} />
        <InfoRow label="邮箱" value={profile.email} />
        <InfoRow label="身份" value={profile.roles.join("、")} />
        <InfoRow
          label="会话有效期"
          value={dateTimeFormatter.format(new Date(session.expiresAtMs))}
        />
      </dl>
      <Button
        className="mt-5 min-h-11"
        onClick={onLogout}
        type="button"
        variant="danger"
      >
        <LogOut aria-hidden="true" className="size-4" />
        退出登录
      </Button>
    </PanelShell>
  );
}

export function GeneralPanel() {
  return (
    <PanelShell description="通用偏好设置。更多选项陆续开放。" title="General">
      <p className="py-6 text-sm leading-6 text-muted">
        暂无可调整的通用选项。
      </p>
    </PanelShell>
  );
}

export function AppearancePanel() {
  return (
    <PanelShell description="调整界面主题外观。" title="Appearance">
      <div className="flex items-center justify-between gap-4 border-b border-border py-5">
        <div className="min-w-0">
          <p className="text-sm font-medium">主题</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            在浅色和深色之间切换。
          </p>
        </div>
        <ThemeToggle />
      </div>
    </PanelShell>
  );
}

export function DataPanel() {
  const [notice, setNotice] = useState("");

  function handleClear() {
    clearLocalLlmConfig();
    setNotice("本地 LLM 配置和 API Key 已删除。");
  }

  return (
    <PanelShell description="管理保存在本浏览器的数据。" title="数据管理">
      <div className="grid gap-4 py-6">
        <div className="rounded-md border border-border bg-surface px-4 py-4">
          <p className="text-sm font-medium">本地 LLM 配置</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            清除保存在当前浏览器的 Provider、Base URL、Model 和 API Key。
          </p>
          <Button
            className="mt-4 min-h-11"
            onClick={handleClear}
            type="button"
            variant="danger"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            删除本地配置
          </Button>
        </div>
      </div>
      {notice ? (
        <p className="text-sm text-muted" role="status">
          {notice}
        </p>
      ) : null}
    </PanelShell>
  );
}
