"use client";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import {
  Bell,
  ChevronDown,
  Info,
  Save,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type PanelKey = "algorithm" | "basic" | "notify" | "security";

type SettingsModel = {
  algAutoReview: boolean;
  algCareDelay: string;
  algSensitivity: number;
  algThreshold: number;
  domain: string;
  lang: string;
  ntfDaily: boolean;
  ntfEmail: string;
  ntfQueue: boolean;
  ntfSignup: boolean;
  ntfSpike: boolean;
  platform: string;
  secIp: boolean;
  secLock: string;
  secMfa: boolean;
  secTimeout: string;
  support: string;
  timezone: string;
};

const INITIAL_MODEL: SettingsModel = {
  algAutoReview: true,
  algCareDelay: "1h",
  algSensitivity: 6,
  algThreshold: 3,
  domain: "admin.moodmate.app",
  lang: "zh",
  ntfDaily: true,
  ntfEmail: "ops@moodmate.app",
  ntfQueue: false,
  ntfSignup: false,
  ntfSpike: true,
  platform: "MoodMate",
  secIp: false,
  secLock: "5",
  secMfa: true,
  secTimeout: "60",
  support: "support@moodmate.app",
  timezone: "utc8",
};

const PANELS: ReadonlyArray<{
  icon: LucideIcon;
  key: PanelKey;
  label: string;
}> = [
  { icon: Info, key: "basic", label: "基础信息" },
  { icon: Bell, key: "notify", label: "通知提醒" },
  { icon: Shield, key: "security", label: "安全策略" },
  { icon: SlidersHorizontal, key: "algorithm", label: "情绪算法" },
];

export function SystemSettingsPage() {
  const [model, setModel] = useState<SettingsModel>(INITIAL_MODEL);
  const [saved, setSaved] = useState<SettingsModel>(INITIAL_MODEL);
  const [activePanel, setActivePanel] = useState<PanelKey>("basic");
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty = useMemo(
    () => JSON.stringify(model) !== JSON.stringify(saved),
    [model, saved],
  );

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  function update<K extends keyof SettingsModel>(
    key: K,
    value: SettingsModel[K],
  ) {
    setJustSaved(false);
    setModel((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    setSaved(model);
    setJustSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setJustSaved(false), 1600);
  }

  function handleReset() {
    setJustSaved(false);
    setModel(saved);
  }

  return (
    <section className="mx-auto w-full max-w-[75rem]">
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">系统设置</h1>
          <p className="mt-1 text-xs leading-6 text-muted sm:text-sm">
            配置 MoodMate 后台的基础信息、通知、安全策略与情绪算法参数
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <SaveStatusBadge isDirty={isDirty} justSaved={justSaved} />
          <Button
            disabled={!isDirty}
            onClick={handleReset}
            size="sm"
            type="button"
            variant="outline"
          >
            放弃修改
          </Button>
          <Button
            disabled={!isDirty}
            onClick={handleSave}
            size="sm"
            type="button"
          >
            <Save className="size-4" />
            保存设置
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
        <nav
          aria-label="设置分区"
          className="flex gap-1 overflow-x-auto lg:sticky lg:top-20 lg:flex-col lg:overflow-visible"
        >
          {PANELS.map((panel) => {
            const Icon = panel.icon;
            const active = panel.key === activePanel;

            return (
              <button
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "flex shrink-0 items-center gap-2.5 rounded-md bg-primary-subtle px-3 py-2 text-xs font-semibold text-primary-strong outline-none focus-visible:ring-2 focus-visible:ring-focus lg:text-[0.8125rem]"
                    : "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-xs text-muted outline-none hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus lg:text-[0.8125rem]"
                }
                key={panel.key}
                onClick={() => setActivePanel(panel.key)}
                type="button"
              >
                <Icon className="size-4 shrink-0" />
                {panel.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {activePanel === "basic" ? (
            <BasicPanel model={model} update={update} />
          ) : null}
          {activePanel === "notify" ? (
            <NotifyPanel model={model} update={update} />
          ) : null}
          {activePanel === "security" ? (
            <SecurityPanel model={model} update={update} />
          ) : null}
          {activePanel === "algorithm" ? (
            <AlgorithmPanel model={model} update={update} />
          ) : null}
        </div>
      </div>
    </section>
  );
}

type PanelProps = {
  model: SettingsModel;
  update: <K extends keyof SettingsModel>(
    key: K,
    value: SettingsModel[K],
  ) => void;
};

function BasicPanel({ model, update }: PanelProps) {
  return (
    <SettingsSection
      subtitle="平台身份与区域默认值，影响后台展示与对外通知的落款。"
      title="基础信息"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="setPlatform"
          label="平台名称"
          maxLength={30}
          onChange={(value) => update("platform", value)}
          value={model.platform}
        />
        <TextField
          id="setDomain"
          label="管理后台地址"
          onChange={(value) => update("domain", value)}
          value={model.domain}
        />
        <SelectField
          id="setTimezone"
          label="默认时区"
          onChange={(value) => update("timezone", value)}
          options={[
            { label: "UTC+8 · 北京 / 上海", value: "utc8" },
            { label: "UTC+0 · 伦敦", value: "utc0" },
            { label: "UTC+9 · 东京", value: "utc9" },
            { label: "UTC-5 · 纽约", value: "utc-5" },
          ]}
          value={model.timezone}
        />
        <SelectField
          id="setLang"
          label="默认语言"
          onChange={(value) => update("lang", value)}
          options={[
            { label: "简体中文", value: "zh" },
            { label: "English", value: "en" },
            { label: "日本語", value: "ja" },
          ]}
          value={model.lang}
        />
        <div className="sm:col-span-2">
          <TextField
            hint="用户在 App 内提交反馈时展示的联系邮箱。"
            id="setSupport"
            label="客服邮箱"
            onChange={(value) => update("support", value)}
            type="email"
            value={model.support}
          />
        </div>
      </div>
    </SettingsSection>
  );
}

function NotifyPanel({ model, update }: PanelProps) {
  return (
    <SettingsSection
      subtitle="选择哪些后台事件需要主动推送，避免关键情绪信号被漏看。"
      title="通知提醒"
    >
      <SwitchRow
        checked={model.ntfSpike}
        description="某用户连续记录负面情绪或情绪骤降时，立即通知值班运营。"
        onChange={(value) => update("ntfSpike", value)}
        title="负面情绪突增实时提醒"
      />
      <SwitchRow
        checked={model.ntfDaily}
        description="每天 09:00 汇总前一日打卡量、活跃用户与待处理项，发送到通知邮箱。"
        onChange={(value) => update("ntfDaily", value)}
        title="每日运营简报"
      />
      <SwitchRow
        checked={model.ntfQueue}
        description="待复核记录超过 50 条时提醒内容审核人员。"
        onChange={(value) => update("ntfQueue", value)}
        title="复核队列积压提醒"
      />
      <SwitchRow
        checked={model.ntfSignup}
        description="有新用户完成注册时发送提醒，适合冷启动阶段关注。"
        onChange={(value) => update("ntfSignup", value)}
        title="新用户注册通知"
      />
      <SettingRow
        description="以上提醒统一发送到该邮箱，可与客服邮箱不同。"
        title="通知邮箱"
      >
        <Input
          aria-label="通知邮箱"
          className="h-9 min-h-9 w-full bg-background text-xs sm:w-64"
          onChange={(event) => update("ntfEmail", event.target.value)}
          type="email"
          value={model.ntfEmail}
        />
      </SettingRow>
    </SettingsSection>
  );
}

function SecurityPanel({ model, update }: PanelProps) {
  return (
    <SettingsSection
      subtitle="后台账号的登录与会话保护，情绪档案属敏感数据，建议从严。"
      title="安全策略"
    >
      <SwitchRow
        checked={model.secMfa}
        description="登录后台时要求动态验证码，强烈建议开启。"
        onChange={(value) => update("secMfa", value)}
        title="管理员双重验证 (2FA)"
      />
      <SettingRow
        description="连续输错密码达到次数后临时锁定账号。"
        title="登录失败锁定"
      >
        <InlineSelect
          ariaLabel="登录失败锁定策略"
          onChange={(value) => update("secLock", value)}
          options={[
            { label: "连续 5 次锁定 15 分钟", value: "5" },
            { label: "连续 10 次锁定 15 分钟", value: "10" },
            { label: "不锁定", value: "off" },
          ]}
          value={model.secLock}
        />
      </SettingRow>
      <SettingRow description="无操作超过时长后自动登出。" title="会话超时">
        <InlineSelect
          ariaLabel="会话超时时长"
          onChange={(value) => update("secTimeout", value)}
          options={[
            { label: "30 分钟", value: "30" },
            { label: "1 小时", value: "60" },
            { label: "8 小时", value: "480" },
          ]}
          value={model.secTimeout}
        />
      </SettingRow>
      <SwitchRow
        checked={model.secIp}
        description="仅允许名单内 IP 访问后台，开启前请确认已加入当前网络。"
        onChange={(value) => update("secIp", value)}
        title="IP 访问白名单"
      />
    </SettingsSection>
  );
}

function AlgorithmPanel({ model, update }: PanelProps) {
  return (
    <>
      <SettingsSection
        subtitle="调节情绪识别与预警的敏感度，参数变更对新产生的记录生效。"
        title="情绪算法"
      >
        <SettingRow
          description="数值越高越容易把中性表达判定为负面情绪，召回更全但误报更多。"
          title="情绪识别灵敏度"
        >
          <div className="flex w-full items-center gap-3 sm:w-64">
            <span className="shrink-0 text-[0.6875rem] text-disabled">
              保守
            </span>
            <RangeInput
              ariaLabel="情绪识别灵敏度"
              max={10}
              min={1}
              onChange={(value) => update("algSensitivity", value)}
              value={model.algSensitivity}
            />
            <span className="w-6 text-right text-xs font-semibold text-primary-strong tabular-nums">
              {model.algSensitivity}
            </span>
          </div>
        </SettingRow>
        <SettingRow
          description="同一用户连续多少天出现负面情绪即触发关注标记。"
          title="负面情绪预警阈值"
        >
          <div className="flex w-full items-center gap-3 sm:w-64">
            <RangeInput
              ariaLabel="负面情绪预警阈值"
              max={14}
              min={1}
              onChange={(value) => update("algThreshold", value)}
              value={model.algThreshold}
            />
            <span className="w-6 text-right text-xs font-semibold text-primary-strong tabular-nums">
              {model.algThreshold}
            </span>
            <span className="shrink-0 text-[0.6875rem] text-disabled">天</span>
          </div>
        </SettingRow>
        <SwitchRow
          checked={model.algAutoReview}
          description="被判定为高风险的记录自动排入人工复核，不直接对外。"
          onChange={(value) => update("algAutoReview", value)}
          title="自动进入复核队列"
        />
        <SettingRow
          description="识别到持续低落后，间隔多久推送关怀内容。"
          title="关怀内容推送时机"
        >
          <InlineSelect
            ariaLabel="关怀内容推送时机"
            onChange={(value) => update("algCareDelay", value)}
            options={[
              { label: "即时推送", value: "now" },
              { label: "1 小时后", value: "1h" },
              { label: "次日推送", value: "next" },
            ]}
            value={model.algCareDelay}
          />
        </SettingRow>
      </SettingsSection>

      <DangerZone />
    </>
  );
}

function DangerZone() {
  function handleRetrain() {
    if (
      !window.confirm(
        "用最近 30 天已复核数据重新训练情绪模型？训练期间线上仍使用当前模型。",
      )
    ) {
      return;
    }
    window.alert("已提交训练任务，完成后会发送邮件通知。");
  }

  function handleClearFlags() {
    if (!window.confirm("清空所有历史预警标记？此操作不可撤销。")) return;
    window.alert("已清空预警标记。");
  }

  return (
    <Card className="mt-4 border-[color-mix(in_srgb,var(--color-danger)_30%,var(--color-border))] p-5 shadow-card">
      <h3 className="text-[0.9375rem] font-semibold text-danger">危险操作</h3>
      <p className="mt-1 mb-4 text-xs text-muted">
        以下操作影响范围大，执行前请再次确认。
      </p>
      <SettingRow
        description="用最近 30 天已复核数据重跑一次模型训练，约需 20 分钟。"
        title="重新训练情绪模型"
      >
        <Button
          onClick={handleRetrain}
          size="sm"
          type="button"
          variant="secondary"
        >
          开始重训
        </Button>
      </SettingRow>
      <SettingRow
        description="移除所有历史关注标记，记录本身不受影响，操作不可撤销。"
        title="清空预警标记"
      >
        <Button
          onClick={handleClearFlags}
          size="sm"
          type="button"
          variant="danger"
        >
          清空标记
        </Button>
      </SettingRow>
    </Card>
  );
}

function SaveStatusBadge({
  isDirty,
  justSaved,
}: {
  isDirty: boolean;
  justSaved: boolean;
}) {
  if (justSaved) {
    return (
      <Badge
        aria-live="polite"
        className="gap-1 border-transparent bg-success-subtle text-success"
        role="status"
      >
        <span className="size-1.5 rounded-full bg-current" />
        已保存
      </Badge>
    );
  }

  if (!isDirty) {
    return (
      <span aria-live="polite" className="sr-only" role="status">
        没有未保存修改
      </span>
    );
  }

  return (
    <Badge
      aria-live="polite"
      className="gap-1 border-transparent bg-warning-subtle text-[var(--theme-peach)]"
      role="status"
    >
      <span className="size-1.5 rounded-full bg-current" />
      有未保存修改
    </Badge>
  );
}

function SettingsSection({
  children,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <Card className="p-5 shadow-card">
      <h3 className="text-[0.9375rem] font-semibold">{title}</h3>
      <p className="mt-1 mb-4 text-xs text-muted">{subtitle}</p>
      {children}
    </Card>
  );
}

function SettingRow({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-border py-3.5 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SwitchRow({
  checked,
  description,
  onChange,
  title,
}: {
  checked: boolean;
  description: string;
  onChange: (value: boolean) => void;
  title: string;
}) {
  return (
    <SettingRow description={description} title={title}>
      <Switch ariaLabel={title} checked={checked} onChange={onChange} />
    </SettingRow>
  );
}

function Switch({
  ariaLabel,
  checked,
  onChange,
}: {
  ariaLabel: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        aria-label={ariaLabel}
        checked={checked}
        className="peer sr-only"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="h-[22px] w-10 rounded-full bg-border-strong transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-[18px] after:rounded-full after:bg-background after:shadow-control after:transition-transform after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-[18px] peer-focus-visible:ring-2 peer-focus-visible:ring-focus" />
    </label>
  );
}

function RangeInput({
  ariaLabel,
  max,
  min,
  onChange,
  value,
}: {
  ariaLabel: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <input
      aria-label={ariaLabel}
      className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-border-strong accent-primary outline-none focus-visible:ring-2 focus-visible:ring-focus"
      max={max}
      min={min}
      onChange={(event) => onChange(Number(event.target.value))}
      type="range"
      value={value}
    />
  );
}

function TextField({
  hint,
  id,
  label,
  maxLength,
  onChange,
  type = "text",
  value,
}: {
  hint?: string;
  id: string;
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <div>
      <label
        className="mb-1.5 block text-[0.6875rem] font-semibold text-muted"
        htmlFor={id}
      >
        {label}
      </label>
      <Input
        className="h-9 min-h-9 bg-background text-xs"
        id={id}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
      {hint ? (
        <p className="mt-1.5 text-[0.6875rem] text-disabled">{hint}</p>
      ) : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  onChange,
  options,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <div>
      <label
        className="mb-1.5 block text-[0.6875rem] font-semibold text-muted"
        htmlFor={id}
      >
        {label}
      </label>
      <div className="relative">
        <select
          className="h-9 w-full appearance-none rounded-md border border-border bg-background pr-8 pl-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-focus"
          id={id}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted" />
      </div>
    </div>
  );
}

function InlineSelect({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <div className="relative w-full sm:w-64">
      <select
        aria-label={ariaLabel}
        className="h-9 w-full appearance-none rounded-md border border-border bg-background pr-8 pl-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-focus"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted" />
    </div>
  );
}
