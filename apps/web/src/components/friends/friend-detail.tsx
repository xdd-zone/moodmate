"use client";

import type { Agent } from "@repo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BellOff,
  Check,
  LoaderCircle,
  MessageCircle,
  Pencil,
  RefreshCw,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createDirectChatMutationOptions } from "@/src/api/direct-chat.query";

import {
  deleteUserAgentMutationOptions,
  userAgentDetailQueryOptions,
} from "@/src/api/agent.query";
import { HttpRequestError } from "@/src/lib/http";
import { MoodmateAvatar } from "@/src/components/moodmate/avatar";

import { FriendEditorDialog } from "./friend-editor-dialog";
import {
  friendProfilePlaceholders,
  getFriendProfile,
  getFriendTags,
} from "./friend-models";
type FriendDetailProps = {
  friendId: string;
};

export function FriendDetail({ friendId }: FriendDetailProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const agentQuery = useQuery(userAgentDetailQueryOptions(friendId));
  const deleteMutation = useMutation(
    deleteUserAgentMutationOptions(queryClient),
  );
  const chatMutation = useMutation(
    createDirectChatMutationOptions(queryClient),
  );
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function handleDelete(agent: Agent) {
    const confirmed = window.confirm(`确认暂别朋友「${agent.name}」？`);

    if (!confirmed) return;

    setActionError(null);
    void deleteMutation
      .mutateAsync(agent.id)
      .then(() => router.replace("/friends"))
      .catch((error: unknown) => {
        setActionError(
          error instanceof Error ? error.message : "朋友删除失败，请重试",
        );
      });
  }

  if (agentQuery.isPending) {
    return (
      <FriendDetailState
        icon={<LoaderCircle className="moodmate-spin" />}
        message="正在加载朋友档案"
      />
    );
  }

  if (agentQuery.isError) {
    const isMissing =
      agentQuery.error instanceof HttpRequestError &&
      (agentQuery.error.status === 403 || agentQuery.error.status === 404);

    return (
      <FriendDetailState
        action={
          isMissing ? (
            <Link
              className="moodmate-button moodmate-button--secondary"
              href="/friends"
            >
              <ArrowLeft aria-hidden="true" />
              返回通讯录
            </Link>
          ) : (
            <button
              className="moodmate-button moodmate-button--secondary"
              onClick={() => void agentQuery.refetch()}
              type="button"
            >
              <RefreshCw aria-hidden="true" />
              重新加载
            </button>
          )
        }
        icon={<UserRound />}
        message={isMissing ? "没有找到这位朋友" : "朋友档案加载失败"}
      />
    );
  }

  const agent = agentQuery.data.agent;
  const friendProfile = getFriendProfile(agent);
  const tags = getFriendTags(agent);

  return (
    <>
      <section className="moodmate-friend-detail">
        <header className="moodmate-page-header moodmate-page-header--sticky">
          <div className="moodmate-page-header__title">
            <Link
              aria-label="返回通讯录"
              className="moodmate-icon-button"
              href="/friends"
              title="返回通讯录"
            >
              <ArrowLeft aria-hidden="true" />
            </Link>
            <h1>朋友档案</h1>
          </div>
          <div className="moodmate-page-header__actions">
            {agent.editable ? (
              <button
                className="moodmate-button moodmate-button--secondary"
                disabled={agent.status !== "active"}
                onClick={() => setIsEditorOpen(true)}
                type="button"
              >
                <Pencil aria-hidden="true" />
                <span>编辑</span>
              </button>
            ) : null}
            <button
              className="moodmate-button moodmate-button--primary"
              disabled={agent.status !== "active" || chatMutation.isPending}
              onClick={() =>
                chatMutation.mutate(agent.id, {
                  onSuccess: (data) =>
                    router.push(`/chats/direct/${data.conversation.id}`),
                  onError: (error) =>
                    setActionError(
                      error instanceof Error ? error.message : "无法发起聊天",
                    ),
                })
              }
              type="button"
            >
              <MessageCircle aria-hidden="true" />
              <span>开始聊天</span>
            </button>
          </div>
        </header>

        <div className="moodmate-friend-detail__body moodmate-scroll">
          <div className="moodmate-friend-detail__content">
            <div className="moodmate-friend-identity">
              <MoodmateAvatar
                onSurface
                profile={friendProfile}
                showStatus
                size="xl"
              />
              <div>
                <div className="moodmate-friend-identity__title">
                  <h2>{agent.name}</h2>
                  <span className="moodmate-relationship-pill">
                    <Check aria-hidden="true" />
                    {agent.status === "active" ? "亲密连结" : "已归档"}
                  </span>
                </div>
                <p>{friendProfile.headline}</p>
                <div className="moodmate-friend-tags">
                  {tags.map((tag, index) => (
                    <span className={index === 0 ? "is-primary" : ""} key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="moodmate-friend-stats">
              {friendProfilePlaceholders.stats.map((stat) => (
                <article className="moodmate-friend-stat" key={stat.label}>
                  <span className="moodmate-friend-stat__sample">示例</span>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </article>
              ))}
            </div>

            <FriendTextSection
              label="简介"
              text={agent.description?.trim() || "这位朋友还没有填写简介。"}
            />
            <FriendTextSection
              label="背景故事"
              text={
                agent.storyBackground?.trim() || "这位朋友还没有填写背景故事。"
              }
            />

            <section className="moodmate-friend-section">
              <p className="moodmate-friend-eyebrow">人设配置</p>
              <div className="moodmate-friend-config-list">
                <FriendConfigCard
                  label="PERSONA · 人设定位"
                  text={agent.personaPrompt}
                  fallback="还没有填写人设定位。"
                />
                <FriendConfigCard
                  label="TONE · 语气风格"
                  text={agent.tonePrompt}
                  fallback="还没有填写语气风格。"
                />
                <FriendConfigCard
                  label="GUARDRAILS · 边界与禁忌"
                  text={agent.guardrailsPrompt}
                  fallback="还没有填写边界与禁忌。"
                />
                <FriendConfigCard
                  label="DEFAULT · 默认系统提示词"
                  text={agent.defaultPrompt}
                  fallback="还没有填写默认系统提示词。"
                />
              </div>
            </section>

            <section className="moodmate-friend-section">
              <div className="moodmate-friend-section__heading">
                <div>
                  <p className="moodmate-friend-eyebrow">关于你，TA 记得的</p>
                  <p className="moodmate-friend-section__note">
                    记忆接口尚未接入，以下内容是档案展示示例。
                  </p>
                </div>
                <button
                  className="moodmate-button moodmate-button--secondary"
                  disabled
                  title="记忆管理暂未接入"
                  type="button"
                >
                  管理记忆
                </button>
              </div>
              <div className="moodmate-memory-list">
                {friendProfilePlaceholders.memories.map((memory) => (
                  <div className="moodmate-memory-item" key={memory.label}>
                    <span
                      aria-hidden="true"
                      className="moodmate-memory-item__importance"
                      style={{ opacity: memory.importance / 6 }}
                    />
                    <div>
                      <span className="moodmate-memory-item__type">
                        {memory.label} · 重要度 {memory.importance}
                      </span>
                      <p>{memory.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="moodmate-friend-section moodmate-friend-section--last">
              <p className="moodmate-friend-eyebrow">更多</p>
              {actionError ? (
                <p className="moodmate-form-error" role="alert">
                  {actionError}
                </p>
              ) : null}
              <div className="moodmate-friend-more-actions">
                <button
                  className="moodmate-button moodmate-button--secondary"
                  disabled
                  title="消息免打扰暂未开放"
                  type="button"
                >
                  <BellOff aria-hidden="true" />
                  消息免打扰
                </button>
                <button
                  className="moodmate-button moodmate-button--danger"
                  disabled={deleteMutation.isPending}
                  onClick={() => handleDelete(agent)}
                  type="button"
                >
                  {deleteMutation.isPending ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="moodmate-spin"
                    />
                  ) : (
                    <Trash2 aria-hidden="true" />
                  )}
                  暂别这位朋友
                </button>
              </div>
            </section>
          </div>
        </div>
      </section>

      <FriendEditorDialog
        agent={agent}
        onClose={() => setIsEditorOpen(false)}
        open={isEditorOpen}
      />
    </>
  );
}

function FriendTextSection({ label, text }: { label: string; text: string }) {
  return (
    <section className="moodmate-friend-section">
      <p className="moodmate-friend-eyebrow">{label}</p>
      <p className="moodmate-friend-copy">{text}</p>
    </section>
  );
}

function FriendConfigCard({
  fallback,
  label,
  text,
}: {
  fallback: string;
  label: string;
  text: string | null;
}) {
  return (
    <article className="moodmate-friend-config-card">
      <span>{label}</span>
      <p>{text?.trim() || fallback}</p>
    </article>
  );
}

function FriendDetailState({
  action,
  icon,
  message,
}: {
  action?: React.ReactNode;
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="moodmate-friend-detail-state">
      {icon}
      <p>{message}</p>
      {action}
    </div>
  );
}
