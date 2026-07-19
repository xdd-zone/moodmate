"use client";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import {
  Check,
  Eye,
  HeartHandshake,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

type Cap = "create" | "delete" | "edit" | "export" | "view";
type GrantMap = Record<string, Set<Cap>>;
type Grants = Record<string, GrantMap>;

type RoleDef = {
  builtin: boolean;
  colorVar: string;
  desc: string;
  icon: LucideIcon;
  key: string;
  members: number;
  name: string;
};

type PermItem = { caps: readonly Cap[]; key: string; name: string };
type ModuleGroup = { group: string; perms: readonly PermItem[] };

const CAP_ORDER: readonly Cap[] = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
];
const CAP_LABELS: Record<Cap, string> = {
  view: "查看",
  create: "新建",
  edit: "编辑",
  delete: "删除",
  export: "导出",
};

const MODULES: readonly ModuleGroup[] = [
  {
    group: "运营",
    perms: [
      { caps: CAP_ORDER, key: "moods", name: "情绪记录" },
      { caps: CAP_ORDER, key: "users", name: "用户管理" },
      { caps: CAP_ORDER, key: "content", name: "内容管理" },
    ],
  },
  {
    group: "分析",
    perms: [
      { caps: ["view", "export"], key: "dashboard", name: "数据概览" },
      { caps: ["view", "export"], key: "reports", name: "运营报表" },
    ],
  },
  {
    group: "系统",
    perms: [
      {
        caps: ["view", "create", "edit", "delete"],
        key: "roles",
        name: "角色权限",
      },
      { caps: ["view", "edit"], key: "settings", name: "系统设置" },
    ],
  },
];

const ALL_PERMS = MODULES.flatMap((moduleGroup) => moduleGroup.perms);

const INITIAL_ROLES: readonly RoleDef[] = [
  {
    builtin: true,
    colorVar: "var(--theme-mauve)",
    desc: "拥有全部模块的最高权限，可管理角色与系统设置，账号受双重验证保护。",
    icon: ShieldCheck,
    key: "admin",
    members: 3,
    name: "超级管理员",
  },
  {
    builtin: true,
    colorVar: "var(--theme-blue)",
    desc: "负责情绪记录审阅、用户运营与内容推送，不可改动角色权限与系统配置。",
    icon: Users,
    key: "ops",
    members: 12,
    name: "运营",
  },
  {
    builtin: true,
    colorVar: "var(--theme-teal)",
    desc: "专注心情日记与标签的合规审核，可标记需关注记录并进入复核队列。",
    icon: Eye,
    key: "review",
    members: 8,
    name: "内容审核",
  },
  {
    builtin: false,
    colorVar: "var(--theme-peach)",
    desc: "只读访问被授权用户的情绪档案，可推送关怀内容，不涉及后台管理操作。",
    icon: HeartHandshake,
    key: "counselor",
    members: 5,
    name: "心理咨询师",
  },
];

const BUILTIN_ROLE_KEYS = new Set(["admin", "ops", "review"]);

function emptyGrantMap(): GrantMap {
  const map: GrantMap = {};
  for (const perm of ALL_PERMS) map[perm.key] = new Set<Cap>();
  return map;
}

function buildDefaultGrants(): Grants {
  const admin = emptyGrantMap();
  for (const perm of ALL_PERMS) admin[perm.key] = new Set(perm.caps);

  const ops = emptyGrantMap();
  for (const key of ["moods", "users", "content"]) {
    ops[key] = new Set<Cap>(["view", "create", "edit", "export"]);
  }
  for (const key of ["dashboard", "reports"]) {
    ops[key] = new Set<Cap>(["view", "export"]);
  }
  ops.roles = new Set<Cap>(["view"]);
  ops.settings = new Set<Cap>(["view"]);

  const review = emptyGrantMap();
  review.moods = new Set<Cap>(["view", "edit", "export"]);
  review.content = new Set<Cap>(["view", "edit"]);
  review.users = new Set<Cap>(["view"]);
  review.dashboard = new Set<Cap>(["view"]);

  const counselor = emptyGrantMap();
  counselor.users = new Set<Cap>(["view"]);
  counselor.moods = new Set<Cap>(["view"]);

  return { admin, counselor, ops, review };
}

function cloneGrantMap(source: GrantMap | undefined): GrantMap {
  const copy: GrantMap = {};
  for (const perm of ALL_PERMS) {
    copy[perm.key] = new Set(source?.[perm.key] ?? []);
  }
  return copy;
}

const DEFAULT_GRANTS = buildDefaultGrants();

function countPerms(map: GrantMap | undefined): number {
  if (!map) return 0;
  return ALL_PERMS.reduce((sum, perm) => sum + (map[perm.key]?.size ?? 0), 0);
}

export function RolesPage() {
  const [roles, setRoles] = useState<RoleDef[]>(() => [...INITIAL_ROLES]);
  const [grants, setGrants] = useState<Grants>(() => {
    const initial: Grants = {};
    for (const key of Object.keys(DEFAULT_GRANTS)) {
      initial[key] = cloneGrantMap(DEFAULT_GRANTS[key]);
    }
    return initial;
  });
  const [activeRole, setActiveRole] = useState("ops");
  const [buffer, setBuffer] = useState<GrantMap>(() =>
    cloneGrantMap(DEFAULT_GRANTS.ops),
  );
  const [isDirty, setIsDirty] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [saveStatus, setSaveStatus] = useState("未修改");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    },
    [],
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleRoles = useMemo(
    () =>
      roles.filter(
        (role) =>
          !normalizedSearch ||
          `${role.name} ${role.desc}`.toLowerCase().includes(normalizedSearch),
      ),
    [normalizedSearch, roles],
  );

  const activeRoleDef = roles.find((role) => role.key === activeRole);

  function markDirty(next: boolean) {
    setIsDirty(next);
    setSaveStatus(next ? "有未保存修改" : "未修改");
  }

  function loadBufferFor(roleKey: string, source: Grants) {
    setBuffer(cloneGrantMap(source[roleKey] ?? emptyGrantMap()));
  }

  function selectRole(roleKey: string) {
    if (roleKey === activeRole) return;
    if (
      isDirty &&
      !window.confirm("当前权限尚未保存，切换角色会放弃这些修改。是否继续？")
    ) {
      return;
    }
    setActiveRole(roleKey);
    loadBufferFor(roleKey, grants);
    markDirty(false);
  }

  function toggleCell(permKey: string, cap: Cap) {
    setBuffer((current) => {
      const nextSet = new Set(current[permKey]);
      if (nextSet.has(cap)) nextSet.delete(cap);
      else nextSet.add(cap);
      return { ...current, [permKey]: nextSet };
    });
    markDirty(true);
  }

  function handleSavePermissions() {
    setGrants((current) => ({
      ...current,
      [activeRole]: cloneGrantMap(buffer),
    }));
    setIsDirty(false);
    setSaveStatus("已保存");
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setSaveStatus("未修改"), 1400);
  }

  function handleCancelPermissions() {
    loadBufferFor(activeRole, grants);
    markDirty(false);
  }

  function handleResetRoles() {
    if (
      !window.confirm(
        "将所有内置角色的权限恢复为默认值，自定义角色不受影响。是否继续？",
      )
    ) {
      return;
    }
    setGrants((current) => {
      const next: Grants = { ...current };
      for (const key of BUILTIN_ROLE_KEYS) {
        next[key] = cloneGrantMap(DEFAULT_GRANTS[key]);
      }
      if (BUILTIN_ROLE_KEYS.has(activeRole)) {
        setBuffer(cloneGrantMap(DEFAULT_GRANTS[activeRole]));
      }
      return next;
    });
    setIsDirty(false);
    setSaveStatus("已恢复默认");
  }

  function handleDeleteRole(roleKey: string) {
    const role = roles.find((item) => item.key === roleKey);
    if (!role) return;
    if (!window.confirm(`删除角色“${role.name}”？该操作不会删除成员账号。`)) {
      return;
    }

    const remaining = roles.filter((item) => item.key !== roleKey);
    setRoles(remaining);
    setGrants((current) => {
      const next = { ...current };
      delete next[roleKey];
      return next;
    });

    if (activeRole === roleKey) {
      const fallback = remaining[0]?.key ?? "";
      setActiveRole(fallback);
      loadBufferFor(fallback, grants);
      markDirty(false);
    }
  }

  function handleCreateRole(input: {
    copyFrom: string;
    desc: string;
    name: string;
  }) {
    const key = `custom-${roles.length}-${input.name}`;
    const source = grants[input.copyFrom] ?? emptyGrantMap();
    const newRole: RoleDef = {
      builtin: false,
      colorVar: "var(--theme-lavender)",
      desc: input.desc,
      icon: UserPlus,
      key,
      members: 0,
      name: input.name,
    };

    setRoles((current) => [...current, newRole]);
    setGrants((current) => ({ ...current, [key]: cloneGrantMap(source) }));
    setActiveRole(key);
    setBuffer(cloneGrantMap(source));
    markDirty(false);
    setDrawerOpen(false);
  }

  return (
    <section className="mx-auto w-full max-w-[90rem]">
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">角色权限</h1>
          <p className="mt-1 text-xs leading-6 text-muted sm:text-sm">
            定义后台角色及其对各业务模块的操作权限，权限变更即时对该角色下所有成员生效
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            onClick={handleResetRoles}
            size="sm"
            type="button"
            variant="outline"
          >
            <RotateCcw className="size-4" />
            重置为默认
          </Button>
          <Button onClick={() => setDrawerOpen(true)} size="sm" type="button">
            <Plus className="size-4" />
            新建角色
          </Button>
        </div>
      </div>

      <label className="relative mb-5 block max-w-sm">
        <span className="sr-only">搜索角色或权限项</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-disabled" />
        <Input
          className="h-9 min-h-9 bg-background pl-9 text-xs"
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="搜索角色、权限项"
          value={searchTerm}
        />
      </label>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleRoles.length > 0 ? (
          visibleRoles.map((role) => (
            <RoleCard
              isActive={role.key === activeRole}
              key={role.key}
              onDelete={() => handleDeleteRole(role.key)}
              onSelect={() => selectRole(role.key)}
              permCount={countPerms(grants[role.key])}
              role={role}
            />
          ))
        ) : (
          <div className="col-span-full rounded-lg border border-dashed border-border-strong px-5 py-10 text-center text-sm text-muted">
            没有符合条件的角色
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">权限矩阵</p>
            <p className="mt-0.5 text-xs text-muted">
              当前编辑：
              <b className="text-foreground">{activeRoleDef?.name ?? "—"}</b>
              {" · 勾选即授予对应操作权限"}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              aria-live="polite"
              className="min-w-16 text-right text-xs text-muted"
              role="status"
            >
              {saveStatus}
            </span>
            <Button
              disabled={!isDirty}
              onClick={handleCancelPermissions}
              size="sm"
              type="button"
              variant="secondary"
            >
              放弃修改
            </Button>
            <Button
              disabled={!isDirty}
              onClick={handleSavePermissions}
              size="sm"
              type="button"
            >
              <Save className="size-4" />
              保存权限
            </Button>
          </div>
        </div>

        <PermissionMatrix
          buffer={buffer}
          onToggle={toggleCell}
          search={normalizedSearch}
        />
      </Card>

      <NewRoleDrawer
        onClose={() => setDrawerOpen(false)}
        onCreate={handleCreateRole}
        open={drawerOpen}
        roles={roles}
      />
    </section>
  );
}

function RoleCard({
  isActive,
  onDelete,
  onSelect,
  permCount,
  role,
}: {
  isActive: boolean;
  onDelete: () => void;
  onSelect: () => void;
  permCount: number;
  role: RoleDef;
}) {
  const Icon = role.icon;

  return (
    <div
      aria-current={isActive ? "true" : undefined}
      aria-label={`选择角色 ${role.name}`}
      className={
        isActive
          ? "flex cursor-pointer flex-col gap-3 rounded-lg border border-primary bg-surface p-4 shadow-card ring-1 ring-primary outline-none focus-visible:ring-2 focus-visible:ring-focus"
          : "flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card transition-colors outline-none hover:border-border-strong hover:shadow-soft focus-visible:ring-2 focus-visible:ring-focus"
      }
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-md"
          style={{
            background: `color-mix(in srgb, ${role.colorVar} 15%, transparent)`,
            color: role.colorVar,
          }}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-semibold">{role.name}</p>
          <span className="mt-1 inline-block">
            <Badge variant={role.builtin ? "secondary" : "outline"}>
              {role.builtin ? "内置" : "自定义"}
            </Badge>
          </span>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted">{role.desc}</p>
      <div className="flex gap-4 border-t border-border pt-3 text-xs text-muted">
        <span>
          <b className="font-semibold text-foreground tabular-nums">
            {role.members}
          </b>{" "}
          名成员
        </span>
        <span>
          <b className="font-semibold text-foreground tabular-nums">
            {permCount}
          </b>{" "}
          项权限
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Pencil className="size-4" />
          配置权限
        </Button>
        {role.builtin ? (
          <Button
            aria-label="内置角色不能删除"
            className="size-9 min-h-9 p-0"
            disabled
            size="icon"
            title="内置角色不能删除"
            type="button"
            variant="ghost"
          >
            <Lock className="size-4" />
          </Button>
        ) : (
          <Button
            aria-label={`删除${role.name}`}
            className="size-9 min-h-9 p-0"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            size="icon"
            title="删除角色"
            type="button"
            variant="ghost"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function PermissionMatrix({
  buffer,
  onToggle,
  search,
}: {
  buffer: GrantMap;
  onToggle: (permKey: string, cap: Cap) => void;
  search: string;
}) {
  const filteredGroups = MODULES.map((moduleGroup) => ({
    group: moduleGroup.group,
    perms: moduleGroup.perms.filter(
      (perm) =>
        !search ||
        `${moduleGroup.group} ${perm.name} ${perm.key} ${perm.caps
          .map((cap) => CAP_LABELS[cap])
          .join(" ")}`
          .toLowerCase()
          .includes(search),
    ),
  })).filter((moduleGroup) => moduleGroup.perms.length > 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="min-w-56 px-3.5 py-3 text-left text-[0.6875rem] font-semibold text-muted uppercase">
              权限项
            </th>
            {CAP_ORDER.map((cap) => (
              <th
                className="w-24 px-3.5 py-3 text-center text-[0.6875rem] font-semibold text-muted uppercase"
                key={cap}
              >
                {CAP_LABELS[cap]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredGroups.length > 0 ? (
            filteredGroups.map((moduleGroup) => (
              <MatrixGroup
                buffer={buffer}
                group={moduleGroup}
                key={moduleGroup.group}
                onToggle={onToggle}
              />
            ))
          ) : (
            <tr>
              <td
                className="px-5 py-11 text-center text-sm text-muted"
                colSpan={CAP_ORDER.length + 1}
              >
                没有符合条件的权限项
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MatrixGroup({
  buffer,
  group,
  onToggle,
}: {
  buffer: GrantMap;
  group: { group: string; perms: readonly PermItem[] };
  onToggle: (permKey: string, cap: Cap) => void;
}) {
  return (
    <>
      <tr>
        <td
          className="bg-surface-muted px-3.5 py-2 text-[0.6875rem] font-semibold text-muted uppercase"
          colSpan={CAP_ORDER.length + 1}
        >
          {group.group}
        </td>
      </tr>
      {group.perms.map((perm) => (
        <tr className="border-b border-border last:border-b-0" key={perm.key}>
          <td className="px-3.5 py-3">
            <div className="text-xs font-semibold">{perm.name}</div>
            <div className="text-[0.6875rem] text-disabled">{perm.key}</div>
          </td>
          {CAP_ORDER.map((cap) => {
            const available = perm.caps.includes(cap);
            const on = buffer[perm.key]?.has(cap) ?? false;

            return (
              <td className="px-3.5 py-3 text-center" key={cap}>
                {available ? (
                  <button
                    aria-label={`${perm.name} ${CAP_LABELS[cap]}权限`}
                    aria-pressed={on}
                    className={
                      on
                        ? "grid size-5 place-items-center rounded-sm border border-primary bg-primary outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        : "grid size-5 place-items-center rounded-sm border border-border-strong bg-background outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-focus"
                    }
                    onClick={() => onToggle(perm.key, cap)}
                    type="button"
                  >
                    <Check
                      className={
                        on
                          ? "size-3 text-primary-foreground"
                          : "size-3 text-transparent"
                      }
                      strokeWidth={3}
                    />
                  </button>
                ) : (
                  <span className="text-disabled">—</span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function NewRoleDrawer({
  onClose,
  onCreate,
  open,
  roles,
}: {
  onClose: () => void;
  onCreate: (input: { copyFrom: string; desc: string; name: string }) => void;
  open: boolean;
  roles: readonly RoleDef[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [copyFrom, setCopyFrom] = useState("ops");
  const [nameError, setNameError] = useState("");
  const [descError, setDescError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      setName("");
      setDesc("");
      setCopyFrom(roles[0]?.key ?? "ops");
      setNameError("");
      setDescError("");
      setTimeout(() => nameRef.current?.focus(), 220);
    }
    if (!open && dialog.open) dialog.close();
  }, [open, roles]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedDesc = desc.trim();
    const nameMsg = !trimmedName
      ? "请输入角色名称。"
      : roles.some((role) => role.name === trimmedName)
        ? "这个角色名称已经存在。"
        : "";
    const descMsg = !trimmedDesc ? "请说明这个角色负责什么。" : "";
    setNameError(nameMsg);
    setDescError(descMsg);
    if (nameMsg || descMsg) return;

    onCreate({ copyFrom, desc: trimmedDesc, name: trimmedName });
  }

  return (
    <dialog
      aria-labelledby="new-role-title"
      className="mood-detail-dialog fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-foreground"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <aside className="mood-detail-drawer ml-auto flex h-dvh w-full max-w-[27.5rem] flex-col border-l border-border bg-background shadow-soft">
        <header className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold" id="new-role-title">
              新建角色
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              先复制一组已有权限，再按需要调整。
            </p>
          </div>
          <Button
            aria-label="关闭新建角色抽屉"
            className="ml-auto size-9 min-h-9 p-0"
            onClick={onClose}
            size="icon"
            type="button"
            variant="secondary"
          >
            <X className="size-4" />
          </Button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-5 flex items-start gap-3 rounded-lg bg-surface-muted p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-subtle text-primary">
                <UserPlus className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">自定义角色</p>
                <p className="mt-0.5 text-xs text-muted">
                  创建后会自动选中，可继续在权限矩阵中编辑。
                </p>
              </div>
            </div>

            <label
              className="mb-1.5 block text-[0.6875rem] font-semibold text-muted"
              htmlFor="roleName"
            >
              角色名称
            </label>
            <Input
              autoComplete="off"
              className="h-9 min-h-9 bg-background text-xs"
              id="roleName"
              maxLength={20}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：用户支持"
              ref={nameRef}
              value={name}
            />
            <p
              className="mt-1.5 min-h-4 text-[0.6875rem] text-danger"
              role="alert"
            >
              {nameError}
            </p>

            <label
              className="mt-2.5 mb-1.5 block text-[0.6875rem] font-semibold text-muted"
              htmlFor="roleDescription"
            >
              角色说明
            </label>
            <textarea
              className="min-h-20 w-full resize-y rounded-md border border-border bg-background px-3 py-2.5 text-xs leading-6 outline-none focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-focus"
              id="roleDescription"
              maxLength={80}
              onChange={(event) => setDesc(event.target.value)}
              placeholder="说明该角色负责什么，以及不能执行哪些操作。"
              value={desc}
            />
            <p
              className="mt-1.5 min-h-4 text-[0.6875rem] text-danger"
              role="alert"
            >
              {descError}
            </p>

            <label
              className="mt-2.5 mb-1.5 block text-[0.6875rem] font-semibold text-muted"
              htmlFor="copyRole"
            >
              复制权限
            </label>
            <div className="relative">
              <select
                className="h-9 w-full appearance-none rounded-md border border-border bg-background pr-8 pl-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-focus"
                id="copyRole"
                onChange={(event) => setCopyFrom(event.target.value)}
                value={copyFrom}
              >
                {roles.map((role) => (
                  <option key={role.key} value={role.key}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1.5 text-[0.6875rem] text-disabled">
              复制后不会影响原角色。
            </p>
          </div>

          <footer className="flex gap-2.5 border-t border-border p-5">
            <Button
              className="flex-1"
              onClick={onClose}
              size="sm"
              type="button"
              variant="secondary"
            >
              取消
            </Button>
            <Button className="flex-1" size="sm" type="submit">
              创建角色
            </Button>
          </footer>
        </form>
      </aside>
    </dialog>
  );
}
