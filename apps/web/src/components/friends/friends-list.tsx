"use client";

import type { Agent } from "@repo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  deleteUserAgentMutationOptions,
  userAgentsQueryOptions,
} from "@/src/api/agent.query";
import { MoodmateAvatar } from "@/src/components/moodmate/avatar";
import { classNames } from "@/src/components/moodmate/class-names";

import { FriendEditorDialog } from "./friend-editor-dialog";
import {
  friendFilters,
  getFriendProfile,
  matchesFriendFilter,
  type FriendFilter,
} from "./friend-models";
export function FriendsList() {
  const queryClient = useQueryClient();
  const agentsQuery = useQuery(userAgentsQueryOptions());
  const deleteMutation = useMutation(
    deleteUserAgentMutationOptions(queryClient),
  );
  const [filter, setFilter] = useState<FriendFilter>("all");
  const [search, setSearch] = useState("");
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const agents = useMemo(
    () => agentsQuery.data?.items ?? [],
    [agentsQuery.data],
  );

  const visibleAgents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("zh-CN");

    return agents.filter((agent) => {
      if (!matchesFriendFilter(agent, filter)) return false;
      if (!query) return true;

      return [agent.name, agent.headline, agent.description]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("zh-CN")
        .includes(query);
    });
  }, [agents, filter, search]);

  function openCreate() {
    setEditingAgent(null);
    setIsEditorOpen(true);
  }

  function openEdit(agent: Agent) {
    setEditingAgent(agent);
    setIsEditorOpen(true);
  }

  async function handleDelete(agent: Agent) {
    const confirmed = window.confirm(`确认暂别朋友「${agent.name}」？`);

    if (!confirmed) return;

    setActionError(null);

    try {
      await deleteMutation.mutateAsync(agent.id);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "朋友删除失败，请重试",
      );
    }
  }

  function getFilterCount(nextFilter: FriendFilter) {
    return agents.filter((agent) => matchesFriendFilter(agent, nextFilter))
      .length;
  }

  return (
    <>
      <section className="moodmate-friends">
        <header className="moodmate-page-header">
          <h1>通讯录</h1>
          <div className="moodmate-page-header__actions">
            <label className="moodmate-friends-search">
              <Search aria-hidden="true" />
              <span className="sr-only">搜索朋友</span>
              <input
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="搜索朋友…"
                type="search"
                value={search}
              />
            </label>
            <button
              className="moodmate-button moodmate-button--primary"
              onClick={openCreate}
              type="button"
            >
              <Plus aria-hidden="true" />
              认识新朋友
            </button>
          </div>
        </header>

        <div
          aria-label="朋友筛选"
          className="moodmate-friends-tabs"
          role="tablist"
        >
          {friendFilters.map((item) => (
            <button
              aria-selected={filter === item.key}
              className={classNames(
                "moodmate-friends-tab",
                filter === item.key && "moodmate-friends-tab--active",
              )}
              key={item.key}
              onClick={() => setFilter(item.key)}
              role="tab"
              type="button"
            >
              {item.label}
              <span>{getFilterCount(item.key)}</span>
            </button>
          ))}
        </div>

        {actionError ? (
          <div className="moodmate-friends-alert" role="alert">
            <p>{actionError}</p>
            <button onClick={() => setActionError(null)} type="button">
              关闭
            </button>
          </div>
        ) : null}

        <div className="moodmate-contact-grid moodmate-scroll">
          {agentsQuery.isPending ? (
            <FriendsState
              icon={<LoaderCircle className="moodmate-spin" />}
              message="正在加载朋友列表"
            />
          ) : agentsQuery.isError ? (
            <FriendsState
              action={
                <button
                  className="moodmate-button moodmate-button--secondary"
                  onClick={() => void agentsQuery.refetch()}
                  type="button"
                >
                  <RefreshCw aria-hidden="true" />
                  重新加载
                </button>
              }
              icon={<UsersRound />}
              message="朋友列表加载失败"
            />
          ) : visibleAgents.length === 0 ? (
            <FriendsState
              action={
                filter === "all" && !search ? (
                  <button
                    className="moodmate-button moodmate-button--primary"
                    onClick={openCreate}
                    type="button"
                  >
                    <Plus aria-hidden="true" />
                    认识新朋友
                  </button>
                ) : undefined
              }
              icon={<UsersRound />}
              message={
                search
                  ? "没有找到匹配的朋友"
                  : filter === "archived"
                    ? "当前没有已归档的朋友"
                    : "当前筛选下没有朋友"
              }
            />
          ) : (
            visibleAgents.map((agent) => (
              <FriendCard
                agent={agent}
                isDeleting={
                  deleteMutation.isPending &&
                  deleteMutation.variables === agent.id
                }
                key={agent.id}
                onDelete={
                  agent.editable ? () => void handleDelete(agent) : undefined
                }
                onEdit={agent.editable ? () => openEdit(agent) : undefined}
              />
            ))
          )}
        </div>
      </section>

      <FriendEditorDialog
        agent={editingAgent}
        onClose={() => setIsEditorOpen(false)}
        open={isEditorOpen}
      />
    </>
  );
}

function FriendCard({
  agent,
  isDeleting,
  onDelete,
  onEdit,
}: {
  agent: Agent;
  isDeleting: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
}) {
  const profile = getFriendProfile(agent);

  return (
    <article className="moodmate-contact-card">
      <Link
        aria-label={`查看 ${agent.name} 的档案`}
        className="moodmate-contact-card__surface"
        href={`/friends/${agent.id}`}
      />
      <div className="moodmate-contact-card__head">
        <MoodmateAvatar onSurface profile={profile} showStatus />
        <div>
          <strong>{agent.name}</strong>
          <p>{profile.headline}</p>
        </div>
      </div>

      <p className="moodmate-contact-card__description">
        {agent.description?.trim() || "这位朋友还没有填写详细介绍。"}
      </p>

      <footer className="moodmate-contact-card__footer">
        <span className="moodmate-relationship-pill">
          <Check aria-hidden="true" />
          亲密连结
        </span>
        <div className="moodmate-contact-card__actions">
          {onEdit ? (
            <button
              aria-label={`编辑 ${agent.name}`}
              className="moodmate-icon-button"
              onClick={onEdit}
              title="编辑"
              type="button"
            >
              <Pencil aria-hidden="true" />
            </button>
          ) : null}
          {onDelete ? (
            <button
              aria-label={`暂别 ${agent.name}`}
              className="moodmate-icon-button moodmate-icon-button--danger"
              disabled={isDeleting}
              onClick={onDelete}
              title="暂别这位朋友"
              type="button"
            >
              {isDeleting ? (
                <LoaderCircle aria-hidden="true" className="moodmate-spin" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
            </button>
          ) : null}
          <Link
            aria-label={`查看 ${agent.name} 的档案`}
            className="moodmate-contact-card__open"
            href={`/friends/${agent.id}`}
            title="查看档案"
          >
            <ChevronRight aria-hidden="true" />
          </Link>
        </div>
      </footer>
    </article>
  );
}

function FriendsState({
  action,
  icon,
  message,
}: {
  action?: React.ReactNode;
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="moodmate-friends-state">
      {icon}
      <p>{message}</p>
      {action}
    </div>
  );
}
