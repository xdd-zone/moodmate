"use client";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/table";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleCheckBig,
  Clock3,
  CloudRain,
  Download,
  EllipsisVertical,
  Eye,
  Filter,
  Frown,
  Meh,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Trash2,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

type MoodKey = "bad" | "calm" | "happy" | "low" | "neutral";
type MoodFilter = "all" | "happy" | "low" | "neutral";
type RecordStatus = "attention" | "auto" | "pending" | "reviewed";

type MoodRecord = {
  avatarClass: string;
  city: string;
  handle: string;
  id: string;
  mood: MoodKey;
  name: string;
  note: string;
  score: number;
  source: string;
  status: RecordStatus;
  tags: readonly string[];
  time: string;
};

type MoodConfig = {
  barClass: string;
  icon: LucideIcon;
  label: string;
  toneClass: string;
};

const MOODS: Record<MoodKey, MoodConfig> = {
  happy: {
    barClass: "bg-success",
    icon: Smile,
    label: "积极",
    toneClass: "text-success",
  },
  calm: {
    barClass: "bg-info",
    icon: Circle,
    label: "平静",
    toneClass: "text-info",
  },
  neutral: {
    barClass: "bg-warning",
    icon: Meh,
    label: "一般",
    toneClass: "text-warning",
  },
  low: {
    barClass: "bg-[var(--theme-peach)]",
    icon: Frown,
    label: "低落",
    toneClass: "text-[var(--theme-peach)]",
  },
  bad: {
    barClass: "bg-danger",
    icon: CloudRain,
    label: "糟糕",
    toneClass: "text-danger",
  },
};

const STATUS_CONFIG: Record<
  RecordStatus,
  { className: string; icon: LucideIcon; label: string }
> = {
  reviewed: {
    className: "border-transparent bg-success-subtle text-success",
    icon: CircleCheck,
    label: "已复核",
  },
  pending: {
    className: "border-transparent bg-warning-subtle text-warning",
    icon: Clock3,
    label: "待处理",
  },
  attention: {
    className: "border-transparent bg-danger-subtle text-danger",
    icon: TriangleAlert,
    label: "需关注",
  },
  auto: {
    className: "border-transparent bg-info-subtle text-info",
    icon: Bot,
    label: "自动",
  },
};

const MOOD_FILTERS: ReadonlyArray<{ label: string; value: MoodFilter }> = [
  { label: "全部", value: "all" },
  { label: "积极", value: "happy" },
  { label: "平静", value: "neutral" },
  { label: "低落", value: "low" },
];

const DISTRIBUTION: ReadonlyArray<{
  count: number;
  mood: MoodKey;
  percent: number;
}> = [
  { count: 118, mood: "happy", percent: 36 },
  { count: 96, mood: "calm", percent: 29 },
  { count: 63, mood: "neutral", percent: 19 },
  { count: 32, mood: "low", percent: 10 },
  { count: 18, mood: "bad", percent: 6 },
];

const AVATAR_CLASSES = [
  "bg-[var(--theme-mauve)]",
  "bg-primary",
  "bg-info",
  "bg-[var(--theme-pink)]",
  "bg-[var(--theme-peach)]",
  "bg-success",
] as const;

const NAMES = [
  ["林晚", "linwan"],
  ["陈屿", "chenyu"],
  ["苏晓", "suxiao"],
  ["周野", "zhouye"],
  ["何澄", "hecheng"],
  ["江予", "jiangyu"],
  ["温故", "wengu"],
  ["沈知", "shenzhi"],
  ["顾南", "gunan"],
  ["阮青", "ruanqing"],
  ["白鹭", "bailu"],
  ["叶知秋", "yezhiqiu"],
] as const;

const TAGS = [
  "工作压力",
  "睡眠不足",
  "和朋友出游",
  "运动后",
  "家庭",
  "天气好",
  "考试焦虑",
  "独处",
  "被认可",
  "通勤疲惫",
] as const;

const NOTES = [
  "今天项目上线，虽然忙但一切顺利，团队一起吃了火锅庆祝，感觉被支持。",
  "最近睡得不太好，白天注意力很难集中，晚上还是忍不住刷手机到很晚。",
  "下午去公园走了走，晒了太阳，心里那股闷劲儿散了一些。",
  "和家里通了电话，聊得不多但很安心。想周末回去看看。",
  "项目进度压得有点喘不过气，反复检查还是担心出错，需要休息一下。",
  "没什么特别的一天，平平淡淡，也挺好。",
] as const;

const SOURCES = ["每日打卡", "心情日记", "引导冥想后", "周报总结"] as const;
const MOOD_KEYS: readonly MoodKey[] = [
  "happy",
  "calm",
  "neutral",
  "low",
  "bad",
];

const DEMO_RECORDS = Array.from({ length: 12 }, (_, index) =>
  createDemoRecord(index),
);

const STAT_ITEMS: ReadonlyArray<{
  detail: string;
  detailClass: string;
  direction: "down" | "up";
  icon: LucideIcon;
  iconClass: string;
  label: string;
  spark?: readonly number[];
  suffix?: string;
  value: string;
}> = [
  {
    detail: "12.4% 环比昨日",
    detailClass: "text-success",
    direction: "up",
    icon: CircleCheckBig,
    iconClass: "bg-primary-subtle text-primary-strong",
    label: "今日打卡",
    value: "327",
  },
  {
    detail: "近 7 日均值稳定",
    detailClass: "text-success",
    direction: "up",
    icon: Activity,
    iconClass: "bg-success-subtle text-success",
    label: "平均心情分",
    spark: [40, 55, 48, 70, 62, 80, 72],
    suffix: "/ 10",
    value: "7.2",
  },
  {
    detail: "需人工复核",
    detailClass: "text-danger",
    direction: "down",
    icon: TriangleAlert,
    iconClass: "bg-warning-subtle text-[var(--theme-peach)]",
    label: "需关注（低情绪）",
    value: "18",
  },
  {
    detail: "至少连续 7 天",
    detailClass: "text-success",
    direction: "up",
    icon: Zap,
    iconClass: "bg-info-subtle text-info",
    label: "连续打卡用户",
    value: "452",
  },
];

export function MoodRecordsPage() {
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword.trim().toLowerCase());
  const [moodFilter, setMoodFilter] = useState<MoodFilter>("all");
  const [dateRange, setDateRange] = useState("近 7 天");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [activeRecord, setActiveRecord] = useState<MoodRecord | null>(null);
  const isDetailOpen = activeRecord !== null;

  useEffect(() => {
    if (!isDetailOpen) return;

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setActiveRecord(null);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isDetailOpen]);

  const filteredRecords = useMemo(
    () =>
      DEMO_RECORDS.filter((record) => {
        const moodMatches = matchesMoodFilter(record.mood, moodFilter);
        const keywordMatches =
          deferredKeyword.length === 0 ||
          record.name.toLowerCase().includes(deferredKeyword) ||
          record.handle.toLowerCase().includes(deferredKeyword) ||
          record.tags.some((tag) =>
            tag.toLowerCase().includes(deferredKeyword),
          ) ||
          record.note.toLowerCase().includes(deferredKeyword);

        return moodMatches && keywordMatches;
      }),
    [deferredKeyword, moodFilter],
  );

  const allVisibleSelected =
    filteredRecords.length > 0 &&
    filteredRecords.every((record) => selectedIds.has(record.id));

  function toggleRecord(recordId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }

  function toggleVisibleRecords() {
    setSelectedIds((current) => {
      const next = new Set(current);
      const shouldClear = filteredRecords.every((record) =>
        next.has(record.id),
      );

      for (const record of filteredRecords) {
        if (shouldClear) next.delete(record.id);
        else next.add(record.id);
      }

      return next;
    });
  }

  function clearFilters() {
    setKeyword("");
    setMoodFilter("all");
    setDateRange("全部时间");
  }

  return (
    <section className="mx-auto w-full max-w-[90rem]">
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">情绪记录</h1>
          <p className="mt-1 text-xs leading-6 text-muted sm:text-sm">
            全平台用户的每日情绪打卡与心情日记，共 2,418 条记录
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" type="button" variant="outline">
            <Download className="size-4" />
            导出 CSV
          </Button>
          <Button size="sm" type="button">
            <Plus className="size-4" />
            手动补录
          </Button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_ITEMS.map((item) => (
          <StatCard item={item} key={item.label} />
        ))}
      </div>

      <section className="mb-5 grid gap-3 xl:grid-cols-[2fr_1fr]">
        <MoodDistribution />
        <MoodTrend />
      </section>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3 sm:p-4">
          <label className="relative min-w-0 flex-1 sm:max-w-72 sm:min-w-60">
            <span className="sr-only">按用户名或关键词筛选</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-disabled" />
            <Input
              className="bg-background pl-9 text-xs"
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="按用户名或关键词筛选"
              value={keyword}
            />
          </label>

          <div
            aria-label="情绪类型"
            className="flex h-9 overflow-hidden rounded-md border border-border"
            role="group"
          >
            {MOOD_FILTERS.map((filter) => {
              const active = filter.value === moodFilter;

              return (
                <button
                  aria-pressed={active}
                  className={
                    active
                      ? "border-r border-border bg-primary-subtle px-3 text-xs font-semibold text-primary-strong outline-none last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                      : "border-r border-border bg-surface px-3 text-xs text-muted outline-none last:border-r-0 hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                  }
                  key={filter.value}
                  onClick={() => setMoodFilter(filter.value)}
                  type="button"
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <label className="relative">
            <span className="sr-only">记录时间</span>
            <select
              className="h-9 min-w-32 appearance-none rounded-md border border-border bg-background pr-8 pl-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-focus"
              onChange={(event) => setDateRange(event.target.value)}
              value={dateRange}
            >
              <option>近 7 天</option>
              <option>近 30 天</option>
              <option>本季度</option>
              <option>全部时间</option>
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted" />
          </label>

          <Button
            className="sm:ml-auto"
            size="sm"
            type="button"
            variant="secondary"
          >
            <SlidersHorizontal className="size-4" />
            更多筛选
          </Button>
        </div>

        <AppliedFilters
          dateRange={dateRange}
          keyword={keyword}
          moodFilter={moodFilter}
          onClear={clearFilters}
          onClearKeyword={() => setKeyword("")}
          onClearMood={() => setMoodFilter("all")}
          onClearRange={() => setDateRange("全部时间")}
        />

        <Table className="min-w-[68rem] table-fixed">
          <TableHeader>
            <TableRow className="bg-surface">
              <TableHead className="w-12">
                <input
                  aria-label="选择当前筛选结果"
                  checked={allVisibleSelected}
                  className="size-4 accent-primary"
                  onChange={toggleVisibleRecords}
                  type="checkbox"
                />
              </TableHead>
              <TableHead className="w-44">用户</TableHead>
              <TableHead className="w-24">情绪</TableHead>
              <TableHead className="w-32">心情分</TableHead>
              <TableHead className="w-56">标签</TableHead>
              <TableHead className="w-36">记录时间</TableHead>
              <TableHead className="w-28">状态</TableHead>
              <TableHead className="w-28 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.length > 0 ? (
              filteredRecords.map((record) => (
                <MoodRecordRow
                  isSelected={selectedIds.has(record.id)}
                  key={record.id}
                  onOpen={() => setActiveRecord(record)}
                  onToggle={() => toggleRecord(record.id)}
                  record={record}
                />
              ))
            ) : (
              <TableRow>
                <TableCell className="py-14 text-center text-muted" colSpan={8}>
                  当前筛选条件下没有情绪记录。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3">
          <p className="text-xs text-muted">
            当前结果：
            <span className="font-semibold text-foreground">
              {filteredRecords.length}
            </span>
            <span className="mx-1.5 text-disabled">·</span>
            已选：
            <span className="font-semibold text-foreground">
              {selectedIds.size}
            </span>
          </p>
          <div className="ml-auto flex items-center gap-1" aria-label="分页">
            <PageButton disabled label="上一页">
              <ChevronLeft className="size-4" />
            </PageButton>
            <PageButton active label="第 1 页">
              1
            </PageButton>
            <PageButton label="第 2 页">2</PageButton>
            <PageButton label="第 3 页">3</PageButton>
            <span className="grid size-8 place-items-center text-xs text-muted">
              …
            </span>
            <PageButton label="第 121 页">121</PageButton>
            <PageButton label="下一页">
              <ChevronRight className="size-4" />
            </PageButton>
          </div>
        </div>
      </Card>

      <MoodDetailDialog
        onClose={() => setActiveRecord(null)}
        record={activeRecord}
      />
    </section>
  );
}

function StatCard({ item }: { item: (typeof STAT_ITEMS)[number] }) {
  const Icon = item.icon;
  const DirectionIcon = item.direction === "up" ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs text-muted">{item.label}</span>
        <span
          className={`grid size-8 place-items-center rounded-md ${item.iconClass}`}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="font-mono text-2xl leading-none font-semibold tabular-nums sm:text-[1.75rem]">
        {item.value}
        {item.suffix ? (
          <span className="ml-1.5 text-xs font-normal text-muted">
            {item.suffix}
          </span>
        ) : null}
      </div>
      {item.spark ? (
        <div className="mt-2.5 flex h-7 items-end gap-1">
          {item.spark.map((height, index) => (
            <span
              className={
                index === item.spark!.length - 1
                  ? "flex-1 rounded-t-sm bg-primary"
                  : "flex-1 rounded-t-sm bg-primary-subtle"
              }
              key={index}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      ) : (
        <div
          className={`mt-2 flex items-center gap-1 text-xs ${item.detailClass}`}
        >
          <DirectionIcon className="size-3.5" />
          {item.detail}
        </div>
      )}
    </Card>
  );
}

function MoodDistribution() {
  return (
    <Card className="h-full p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">今日情绪分布</h2>
        <span className="text-xs text-muted">
          327 条打卡 · 按效价从积极到低落排列
        </span>
      </div>
      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
        {DISTRIBUTION.map((item) => {
          const mood = MOODS[item.mood];
          return (
            <span
              className="flex items-center gap-1.5 text-[0.6875rem] text-muted"
              key={item.mood}
            >
              <span className={`size-2 rounded-sm ${mood.barClass}`} />
              {mood.label}
            </span>
          );
        })}
      </div>
      <div
        className="flex h-9 gap-0.5 overflow-hidden rounded-md"
        aria-label="今日情绪分布图"
      >
        {DISTRIBUTION.map((item) => {
          const mood = MOODS[item.mood];
          return (
            <div
              className={`flex min-w-0 items-center justify-center ${mood.barClass}`}
              key={item.mood}
              style={{ flex: item.count }}
              title={`${mood.label} ${item.count} 条，占 ${item.percent}%`}
            >
              <span className="truncate px-1 text-[0.6875rem] font-semibold text-[var(--theme-base)]">
                <span className="hidden sm:inline">{mood.label} </span>
                {item.count}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[0.6875rem] text-disabled">
        <span>积极情绪占比 36%</span>
        <span>需关注人群 15% · 已进入复核队列</span>
      </div>
    </Card>
  );
}

function MoodTrend() {
  const values = [268, 291, 254, 312, 298, 340, 327];
  const labels = [
    "07-12",
    "07-13",
    "07-14",
    "07-15",
    "07-16",
    "07-17",
    "07-18",
  ];
  const points = values
    .map((value, index) => {
      const x = 8 + (index / (values.length - 1)) * 84;
      const y = 88 - ((value - 240) / 110) * 70;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <Card className="h-full p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">近 7 日打卡量</h2>
        <span className="text-xs text-muted">条 / 日</span>
      </div>
      <div className="relative h-44 min-h-44">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-6 text-[0.625rem] text-disabled">
          <span>360</span>
          <span>300</span>
          <span>240</span>
        </div>
        <svg
          aria-label="近 7 日打卡量折线图"
          className="absolute inset-x-6 top-0 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] overflow-visible"
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 100 100"
        >
          <path
            d="M 8 88 H 92 M 8 53 H 92 M 8 18 H 92"
            fill="none"
            stroke="var(--color-border)"
            strokeDasharray="1.5 2"
            strokeWidth="0.55"
          />
          <polygon
            fill="color-mix(in srgb, var(--color-primary) 14%, transparent)"
            points={`8,88 ${points} 92,88`}
          />
          <polyline
            fill="none"
            points={points}
            stroke="var(--color-primary)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          {points.split(" ").map((point, index) => {
            const [cx, cy] = point.split(",");
            return (
              <circle
                cx={cx}
                cy={cy}
                fill="var(--color-background)"
                key={point}
                r="2"
                stroke="var(--color-primary)"
                strokeWidth="1.2"
              >
                <title>{`${labels[index]} ${values[index]} 条`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="absolute inset-x-6 bottom-0 flex justify-between text-[0.625rem] text-disabled">
          {labels.map((label) => (
            <span key={label}>{label.slice(3)}</span>
          ))}
        </div>
      </div>
    </Card>
  );
}

function AppliedFilters({
  dateRange,
  keyword,
  moodFilter,
  onClear,
  onClearKeyword,
  onClearMood,
  onClearRange,
}: {
  dateRange: string;
  keyword: string;
  moodFilter: MoodFilter;
  onClear: () => void;
  onClearKeyword: () => void;
  onClearMood: () => void;
  onClearRange: () => void;
}) {
  const hasFilters =
    keyword.length > 0 || moodFilter !== "all" || dateRange !== "全部时间";

  if (!hasFilters) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
      <Filter className="size-3.5 text-muted" />
      <span className="text-xs text-muted">已应用</span>
      {keyword ? (
        <FilterChip label={`关键词：${keyword}`} onRemove={onClearKeyword} />
      ) : null}
      {moodFilter !== "all" ? (
        <FilterChip
          label={`情绪：${MOOD_FILTERS.find((item) => item.value === moodFilter)?.label ?? moodFilter}`}
          onRemove={onClearMood}
        />
      ) : null}
      {dateRange !== "全部时间" ? (
        <FilterChip label={`时间：${dateRange}`} onRemove={onClearRange} />
      ) : null}
      <button
        className="min-h-8 px-1 text-xs text-muted outline-none hover:text-danger focus-visible:ring-2 focus-visible:ring-focus"
        onClick={onClear}
        type="button"
      >
        清除全部
      </button>
    </div>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="flex min-h-7 items-center gap-1 rounded-full border border-border bg-surface-muted py-0.5 pr-1 pl-2.5 text-xs">
      {label}
      <button
        aria-label={`移除${label}筛选`}
        className="grid size-6 place-items-center rounded-full text-disabled outline-none hover:bg-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
        onClick={onRemove}
        type="button"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function MoodRecordRow({
  isSelected,
  onOpen,
  onToggle,
  record,
}: {
  isSelected: boolean;
  onOpen: () => void;
  onToggle: () => void;
  record: MoodRecord;
}) {
  const mood = MOODS[record.mood];
  const MoodIcon = mood.icon;
  const status = STATUS_CONFIG[record.status];
  const StatusIcon = status.icon;

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  }

  return (
    <TableRow
      aria-label={`查看${record.name}的情绪记录`}
      className={
        isSelected
          ? "group cursor-pointer bg-primary-subtle outline-none hover:bg-primary-subtle focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
          : "group cursor-pointer outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
      }
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <TableCell className="align-middle">
        <input
          aria-label={`选择${record.name}的记录`}
          checked={isSelected}
          className="size-4 accent-primary"
          onChange={onToggle}
          onClick={(event) => event.stopPropagation()}
          type="checkbox"
        />
      </TableCell>
      <TableCell className="align-middle">
        <div className="flex items-center gap-2.5">
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-[var(--theme-base)] ${record.avatarClass}`}
          >
            {record.name.slice(0, 1)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold">
              {record.name}
            </span>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-muted">
              @{record.handle}
            </span>
          </span>
        </div>
      </TableCell>
      <TableCell className="align-middle">
        <span className={`flex items-center gap-1.5 text-xs ${mood.toneClass}`}>
          <MoodIcon className="size-4" />
          <span className="text-foreground">{mood.label}</span>
        </span>
      </TableCell>
      <TableCell className="align-middle">
        <div className="flex items-center gap-2">
          <span className="w-7 text-xs font-semibold tabular-nums">
            {record.score.toFixed(1)}
          </span>
          <span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-muted">
            <span
              className={`block h-full rounded-full ${scoreBarClass(record.score)}`}
              style={{ width: `${record.score * 10}%` }}
            />
          </span>
        </div>
      </TableCell>
      <TableCell className="align-middle">
        <div className="flex flex-wrap gap-1">
          {record.tags.map((tag, index) => (
            <Badge
              className="min-h-5 px-1.5 py-0 text-[0.625rem]"
              key={`${record.id}-${tag}-${index}`}
              variant="secondary"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="align-middle text-xs text-muted tabular-nums">
        {record.time}
      </TableCell>
      <TableCell className="align-middle">
        <Badge className={`gap-1 px-1.5 text-[0.625rem] ${status.className}`}>
          <StatusIcon className="size-3" />
          {status.label}
        </Badge>
      </TableCell>
      <TableCell className="align-middle">
        <div className="flex justify-end gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
          <RowActionButton label="查看记录" onClick={onOpen}>
            <Eye className="size-3.5" />
          </RowActionButton>
          <RowActionButton label="编辑记录">
            <Pencil className="size-3.5" />
          </RowActionButton>
          <RowActionButton danger label="删除记录">
            <Trash2 className="size-3.5" />
          </RowActionButton>
        </div>
      </TableCell>
    </TableRow>
  );
}

function RowActionButton({
  children,
  danger = false,
  label,
  onClick,
}: {
  children: React.ReactNode;
  danger?: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={
        danger
          ? "grid size-8 place-items-center rounded-sm text-muted outline-none hover:bg-danger-subtle hover:text-danger focus-visible:ring-2 focus-visible:ring-focus"
          : "grid size-8 place-items-center rounded-sm text-muted outline-none hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
      }
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function PageButton({
  active = false,
  children,
  disabled = false,
  label,
}: {
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={
        active
          ? "grid size-8 place-items-center rounded-sm bg-primary text-xs font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus"
          : "grid size-8 place-items-center rounded-sm border border-border bg-surface text-xs outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-40"
      }
      disabled={disabled}
      type="button"
    >
      {children}
    </button>
  );
}

function MoodDetailDialog({
  onClose,
  record,
}: {
  onClose: () => void;
  record: MoodRecord | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (record && !dialog.open) dialog.showModal();
    if (!record && dialog.open) dialog.close();
  }, [record]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  const mood = record ? MOODS[record.mood] : null;
  const status = record ? STATUS_CONFIG[record.status] : null;
  const MoodIcon = mood?.icon;
  const StatusIcon = status?.icon;

  return (
    <dialog
      aria-labelledby="mood-detail-title"
      className="mood-detail-dialog fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-foreground"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
      onClose={onClose}
      ref={dialogRef}
    >
      {record && mood && status && MoodIcon && StatusIcon ? (
        <aside className="mood-detail-drawer ml-auto flex h-dvh w-full max-w-[27.5rem] flex-col border-l border-border bg-background shadow-soft">
          <header className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-5">
            <span
              className={`grid size-9 place-items-center rounded-full text-xs font-semibold text-[var(--theme-base)] ${record.avatarClass}`}
            >
              {record.name.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <h2
                className="truncate text-sm font-semibold"
                id="mood-detail-title"
              >
                {record.name}
              </h2>
              <p className="truncate text-xs text-muted">
                @{record.handle} · moodmate.app
              </p>
            </div>
            <Button
              aria-label="关闭详情"
              className="ml-auto size-11 p-0 sm:size-9 sm:min-h-9"
              onClick={onClose}
              size="icon"
              type="button"
              variant="secondary"
            >
              <X className="size-4" />
            </Button>
          </header>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="mb-6 flex items-center gap-3 rounded-md bg-surface-muted p-4">
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-md bg-surface ${mood.toneClass}`}
              >
                <MoodIcon className="size-6" />
              </span>
              <div>
                <p className="text-base font-semibold">{mood.label}</p>
                <p className="mt-0.5 text-xs text-muted">
                  心情分{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {record.score.toFixed(1)}
                  </span>{" "}
                  / 10 · {record.time}
                </p>
              </div>
              <Badge
                className={`ml-auto gap-1 px-1.5 text-[0.625rem] ${status.className}`}
              >
                <StatusIcon className="size-3" />
                {status.label}
              </Badge>
            </div>

            <DetailSection title="记录详情">
              <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
                <dt className="text-muted">记录 ID</dt>
                <dd className="m-0 font-medium tabular-nums">{record.id}</dd>
                <dt className="text-muted">来源</dt>
                <dd className="m-0">{record.source}</dd>
                <dt className="text-muted">设备</dt>
                <dd className="m-0">iOS App · v2.4.1</dd>
                <dt className="text-muted">位置</dt>
                <dd className="m-0">{record.city}</dd>
              </dl>
            </DetailSection>

            <DetailSection title="情绪标签">
              <div className="flex flex-wrap gap-1.5">
                {record.tags.map((tag, index) => (
                  <Badge key={`${record.id}-${tag}-${index}`} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </DetailSection>

            <DetailSection title="心情日记">
              <p className="rounded-md border border-border bg-surface p-3 text-xs leading-6">
                {record.note}
              </p>
            </DetailSection>

            <DetailSection title="近期活动">
              <ol className="relative ml-1 border-l border-border pl-5 text-xs">
                <TimelineItem time="今天 09:12">提交每日打卡</TimelineItem>
                <TimelineItem time="今天 09:12">
                  系统情绪分析完成，加入复核队列
                </TimelineItem>
                <TimelineItem last time="今天 10:40">
                  运营人工复核，建议推送舒缓内容
                </TimelineItem>
              </ol>
            </DetailSection>
          </div>

          <footer className="flex flex-wrap gap-2 border-t border-border p-4 sm:px-5">
            <Button className="flex-1" size="sm" type="button">
              <ShieldCheck className="size-4" />
              标记已复核
            </Button>
            <Button size="sm" type="button" variant="outline">
              推送关怀
            </Button>
            <Button
              aria-label="更多操作"
              className="p-0"
              size="icon"
              type="button"
              variant="ghost"
            >
              <EllipsisVertical className="size-4" />
            </Button>
          </footer>
        </aside>
      ) : null}
    </dialog>
  );
}

function DetailSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="mb-2.5 text-[0.6875rem] font-semibold text-muted uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function TimelineItem({
  children,
  last = false,
  time,
}: {
  children: React.ReactNode;
  last?: boolean;
  time: string;
}) {
  return (
    <li className={last ? "relative" : "relative pb-4"}>
      <span className="absolute top-1 -left-[1.47rem] size-2 rounded-full bg-primary ring-2 ring-background" />
      <p>{children}</p>
      <p className="mt-1 text-[0.6875rem] text-disabled">{time}</p>
    </li>
  );
}

function createDemoRecord(index: number): MoodRecord {
  const person = NAMES[index % NAMES.length] ?? NAMES[0];
  const mood = MOOD_KEYS[(index * 3 + 1) % MOOD_KEYS.length] ?? "calm";
  const score = calculateScore(mood, index);
  const status: RecordStatus =
    mood === "low" || mood === "bad"
      ? index % 2
        ? "attention"
        : "pending"
      : index % 3 === 0
        ? "auto"
        : "reviewed";
  const hour = String(8 + (index % 12)).padStart(2, "0");
  const minute = String((index * 7) % 60).padStart(2, "0");
  const day = String(18 - (index % 9)).padStart(2, "0");

  return {
    avatarClass: AVATAR_CLASSES[index % AVATAR_CLASSES.length] ?? "bg-primary",
    city: index % 3 === 0 ? "上海" : index % 3 === 1 ? "杭州" : "成都",
    handle: person[1],
    id: `#MR-${String(24180 - index).padStart(5, "0")}`,
    mood,
    name: person[0],
    note: NOTES[index % NOTES.length] ?? NOTES[0],
    score,
    source: SOURCES[index % SOURCES.length] ?? SOURCES[0],
    status,
    tags: [
      TAGS[index % TAGS.length] ?? TAGS[0],
      TAGS[(index * 3 + 2) % TAGS.length] ?? TAGS[1],
    ],
    time: `07-${day} ${hour}:${minute}`,
  };
}

function calculateScore(mood: MoodKey, index: number) {
  if (mood === "happy") return 8.2 + (index % 10) / 10;
  if (mood === "calm") return 6.8 + (index % 12) / 10;
  if (mood === "neutral") return 5.4 + (index % 8) / 10;
  if (mood === "low") return 3.6 + (index % 9) / 10;
  return 2.1 + (index % 7) / 10;
}

function matchesMoodFilter(mood: MoodKey, filter: MoodFilter) {
  if (filter === "all") return true;
  if (filter === "happy") return mood === "happy";
  if (filter === "neutral") return mood === "calm" || mood === "neutral";
  return mood === "low" || mood === "bad";
}

function scoreBarClass(score: number) {
  if (score >= 7) return "bg-success";
  if (score >= 5) return "bg-warning";
  if (score >= 3.5) return "bg-[var(--theme-peach)]";
  return "bg-danger";
}
