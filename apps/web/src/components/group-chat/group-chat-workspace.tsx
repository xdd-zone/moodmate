"use client";

import type {
  AgentGroupChatDetail,
  AgentGroupChatMember,
  AgentGroupChatMessage,
  UserAgent,
} from "@repo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LoaderCircle,
  MoreVertical,
  PanelLeft,
  PanelRight,
  Search,
  Send,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { userAgentsQueryOptions } from "@/src/api/agent.query";
import { getGroupChatMessages } from "@/src/api/group-chat.api";
import {
  addGroupChatMembersMutationOptions,
  createGroupChatMutationOptions,
  groupChatKeys,
  removeGroupChatMemberMutationOptions,
  sendGroupChatMessageMutationOptions,
} from "@/src/api/group-chat.query";
import {
  getGroupProfile,
  getMemberProfile,
} from "@/src/components/chat/chat-models";
import { MoodmateAvatar } from "@/src/components/moodmate/avatar";
import { MoodmateDialog } from "@/src/components/moodmate/dialog";
import {
  MoodmateInfoPanel,
  MoodmateInfoSection,
} from "@/src/components/moodmate/info-panel";
import type { MoodmateProfile } from "@/src/components/moodmate/models";

import { MentionTextarea } from "./mention-textarea";

const MAX_MEMBERS = 6;
const RECENT_MESSAGES_LIMIT = 50;

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
});

type GroupChatPaneProps = {
  detail: AgentGroupChatDetail;
  groupChatId: string;
  onInformationToggle: () => void;
  onOpenList: () => void;
  profile: MoodmateProfile;
};

export function GroupChatPane({
  detail,
  groupChatId,
  onInformationToggle,
  onOpenList,
  profile,
}: GroupChatPaneProps) {
  const queryClient = useQueryClient();
  const sendMutation = useMutation(
    sendGroupChatMessageMutationOptions(queryClient),
  );
  const [draft, setDraft] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(() =>
    detail.recentMessages.length >= RECENT_MESSAGES_LIMIT
      ? (detail.recentMessages[0]?.createdAtMs ?? null)
      : null,
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeMembers = detail.members.filter(
    (member) => member.status === "active",
  );
  const groupProfile = {
    ...getGroupProfile(detail.groupChat),
    headline: `${activeMembers.length} 位成员`,
  };
  const canSend = draft.trim().length > 0 && !sendMutation.isPending;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [detail.recentMessages.length]);

  function handleSend() {
    const message = draft.trim();

    if (!message || sendMutation.isPending) return;

    setDraft("");
    sendMutation.mutate(
      { groupChatId, message },
      { onError: () => setDraft(message) },
    );
  }

  async function handleLoadEarlier() {
    if (nextCursor === null || isLoadingEarlier) return;

    setIsLoadingEarlier(true);
    setLoadError(null);

    try {
      const result = await getGroupChatMessages(groupChatId, nextCursor);
      const detailKey = groupChatKeys.detail(groupChatId);

      queryClient.setQueryData<AgentGroupChatDetail>(detailKey, (current) => {
        if (!current) return current;

        const existingIds = new Set(
          current.recentMessages.map((message) => message.id),
        );
        const earlier = result.items.filter(
          (message) => !existingIds.has(message.id),
        );

        return {
          ...current,
          recentMessages: [...earlier, ...current.recentMessages].sort(
            (a, b) => a.createdAtMs - b.createdAtMs,
          ),
        };
      });
      setNextCursor(result.nextCursor);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "加载失败，请重试");
    } finally {
      setIsLoadingEarlier(false);
    }
  }

  return (
    <div className="moodmate-chat">
      <header className="moodmate-chat__header">
        <button
          aria-label="打开会话列表"
          className="moodmate-icon-button moodmate-chat__mobile-action"
          onClick={onOpenList}
          title="打开会话列表"
          type="button"
        >
          <PanelLeft aria-hidden="true" />
        </button>
        <MoodmateAvatar isGroup onSurface profile={groupProfile} size="sm" />
        <div className="moodmate-chat__heading">
          <h1>{detail.groupChat.title}</h1>
          <p>{activeMembers.length} 位成员</p>
        </div>
        <div className="moodmate-chat__actions">
          <button
            aria-label="消息搜索暂未开放"
            className="moodmate-icon-button"
            disabled
            title="消息搜索暂未开放"
            type="button"
          >
            <Search aria-hidden="true" />
          </button>
          <button
            aria-label="切换成员栏"
            className="moodmate-icon-button"
            onClick={onInformationToggle}
            title="切换成员栏"
            type="button"
          >
            <PanelRight aria-hidden="true" />
          </button>
          <button
            aria-label="更多操作暂未开放"
            className="moodmate-icon-button"
            disabled
            title="更多操作暂未开放"
            type="button"
          >
            <MoreVertical aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="moodmate-chat__body">
        <div
          aria-label={`${detail.groupChat.title}的消息`}
          className="moodmate-messages moodmate-scroll"
          role="log"
        >
          <div className="moodmate-messages__inner">
            {nextCursor !== null ? (
              <div className="moodmate-chat__history">
                <button
                  disabled={isLoadingEarlier}
                  onClick={() => void handleLoadEarlier()}
                  type="button"
                >
                  {isLoadingEarlier ? (
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                  ) : null}
                  {isLoadingEarlier ? "正在加载" : "加载更早消息"}
                </button>
              </div>
            ) : null}

            {loadError ? (
              <p className="moodmate-chat__inline-error" role="alert">
                {loadError}
              </p>
            ) : null}

            {detail.recentMessages.length === 0 ? (
              <p className="moodmate-messages__empty">
                还没有消息，先和大家打个招呼。
              </p>
            ) : (
              detail.recentMessages.map((message) => (
                <GroupMessage
                  groupProfile={groupProfile}
                  key={message.id}
                  message={message}
                  userProfile={profile}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="moodmate-group-composer">
          <p>输入 @ 可指定某位朋友优先回复</p>
          <div className="moodmate-group-composer__box">
            <MentionTextarea
              disabled={sendMutation.isPending}
              members={activeMembers}
              onChange={setDraft}
              onSend={handleSend}
              value={draft}
            />
            <button
              aria-label="发送消息"
              className="moodmate-composer__send"
              disabled={!canSend}
              onClick={handleSend}
              title="发送消息"
              type="button"
            >
              {sendMutation.isPending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Send aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function GroupMessage({
  groupProfile,
  message,
  userProfile,
}: {
  groupProfile: MoodmateProfile;
  message: AgentGroupChatMessage;
  userProfile: MoodmateProfile;
}) {
  if (message.senderType === "system") {
    return <p className="moodmate-message__system">{message.content}</p>;
  }

  const isUser = message.senderType === "user";
  const senderProfile = isUser
    ? userProfile
    : getMemberProfile({
        headline: null,
        id: message.agentId ?? message.id,
        name: message.agentName ?? groupProfile.name,
      });

  return (
    <div
      className={`moodmate-message ${
        isUser ? "moodmate-message--outgoing" : "moodmate-message--incoming"
      }`}
    >
      <MoodmateAvatar onSurface={!isUser} profile={senderProfile} size="sm" />
      <div className="moodmate-message__content">
        {!isUser ? (
          <span className="moodmate-message__sender">
            {message.agentName ?? "群聊成员"}
          </span>
        ) : null}
        <div
          className={`moodmate-message__bubble ${
            message.status === "failed"
              ? "moodmate-message__bubble--failed"
              : ""
          }`}
        >
          {message.content}
          <time>{timeFormatter.format(new Date(message.createdAtMs))}</time>
        </div>
      </div>
    </div>
  );
}

export function GroupChatInformation({
  detail,
  groupChatId,
}: {
  detail: AgentGroupChatDetail;
  groupChatId: string;
}) {
  const queryClient = useQueryClient();
  const removeMutation = useMutation(
    removeGroupChatMemberMutationOptions(queryClient),
  );
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const activeMembers = detail.members.filter(
    (member) => member.status === "active",
  );
  const groupProfile = {
    ...getGroupProfile(detail.groupChat),
    headline: `${activeMembers.length} 位成员`,
  };

  async function handleRemove(member: AgentGroupChatMember) {
    if (!window.confirm(`确认移除成员「${member.name}」？`)) return;

    await removeMutation.mutateAsync({ groupChatId, memberId: member.id });
  }

  return (
    <>
      <MoodmateInfoPanel isGroup profile={groupProfile}>
        <MoodmateInfoSection title="群简介">
          <p>
            {detail.groupChat.summary?.trim() ||
              "和几位朋友一起聊聊，每个人都会从自己的角度回应。"}
          </p>
        </MoodmateInfoSection>
        <MoodmateInfoSection
          title={`成员 · ${activeMembers.length} / ${MAX_MEMBERS}`}
        >
          <div className="moodmate-member-list">
            {activeMembers.map((member) => (
              <div className="moodmate-member" key={member.id}>
                <MoodmateAvatar
                  onSurface
                  profile={getMemberProfile(member)}
                  size="xs"
                />
                <div>
                  <strong>{member.name}</strong>
                  <span>{member.headline || "群聊成员"}</span>
                </div>
                <button
                  aria-label={`移除${member.name}`}
                  className="moodmate-icon-button"
                  disabled={removeMutation.isPending}
                  onClick={() => void handleRemove(member)}
                  title={`移除${member.name}`}
                  type="button"
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <button
            className="moodmate-button moodmate-button--secondary moodmate-info__invite"
            disabled={activeMembers.length >= MAX_MEMBERS}
            onClick={() => setIsInviteOpen(true)}
            type="button"
          >
            <UserPlus aria-hidden="true" />
            邀请朋友
          </button>
        </MoodmateInfoSection>
      </MoodmateInfoPanel>

      {isInviteOpen ? (
        <InviteMembersDialog
          existingAgentIds={activeMembers.map((member) => member.agentId)}
          groupChatId={groupChatId}
          onClose={() => setIsInviteOpen(false)}
          open
          remainingSlots={MAX_MEMBERS - activeMembers.length}
        />
      ) : null}
    </>
  );
}

type CreateGroupChatDialogProps = {
  onClose: () => void;
  onCreated: (groupChatId: string) => void;
  open: boolean;
};

export function CreateGroupChatDialog({
  onClose,
  onCreated,
  open,
}: CreateGroupChatDialogProps) {
  const queryClient = useQueryClient();
  const agentsQuery = useQuery(userAgentsQueryOptions());
  const createMutation = useMutation(
    createGroupChatMutationOptions(queryClient),
  );
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setSelected([]);
      setError(null);
    }
  }, [open]);

  function toggle(agentId: string) {
    setSelected((current) =>
      current.includes(agentId)
        ? current.filter((id) => id !== agentId)
        : [...current, agentId],
    );
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setError("请填写群聊名称");
      return;
    }

    if (selected.length === 0) {
      setError("请至少选择一位朋友");
      return;
    }

    if (selected.length > MAX_MEMBERS) {
      setError(`最多选择 ${MAX_MEMBERS} 位朋友`);
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        agentIds: selected,
        title: title.trim(),
      });
      onCreated(result.groupChat.id);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "群聊创建失败",
      );
    }
  }

  return (
    <MoodmateDialog
      description="选择一到六位朋友加入群聊。"
      footer={
        <>
          <button
            className="moodmate-button moodmate-button--secondary"
            onClick={onClose}
            type="button"
          >
            取消
          </button>
          <button
            className="moodmate-button moodmate-button--primary"
            disabled={createMutation.isPending}
            onClick={() => void handleSubmit()}
            type="button"
          >
            {createMutation.isPending ? "正在创建" : "创建群聊"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title="新建群聊"
    >
      <label className="moodmate-field">
        <span>群聊名称</span>
        <input
          maxLength={120}
          onChange={(event) => setTitle(event.currentTarget.value)}
          placeholder="例如：深夜树洞小组"
          value={title}
        />
      </label>
      <AgentPicker
        agents={agentsQuery.data?.items ?? []}
        isPending={agentsQuery.isPending}
        onToggle={toggle}
        selected={selected}
      />
      {error ? (
        <p className="moodmate-form-error" role="alert">
          {error}
        </p>
      ) : null}
    </MoodmateDialog>
  );
}

function InviteMembersDialog({
  existingAgentIds,
  groupChatId,
  onClose,
  open,
  remainingSlots,
}: {
  existingAgentIds: string[];
  groupChatId: string;
  onClose: () => void;
  open: boolean;
  remainingSlots: number;
}) {
  const queryClient = useQueryClient();
  const agentsQuery = useQuery(userAgentsQueryOptions());
  const addMutation = useMutation(
    addGroupChatMembersMutationOptions(queryClient),
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const existingSet = useMemo(
    () => new Set(existingAgentIds),
    [existingAgentIds],
  );
  const candidates = (agentsQuery.data?.items ?? []).filter(
    (agent) => !existingSet.has(agent.id),
  );

  function toggle(agentId: string) {
    setSelected((current) =>
      current.includes(agentId)
        ? current.filter((id) => id !== agentId)
        : [...current, agentId],
    );
  }

  async function handleSubmit() {
    if (selected.length === 0) {
      setError("请至少选择一位朋友");
      return;
    }

    if (selected.length > remainingSlots) {
      setError(`最多还能邀请 ${remainingSlots} 位朋友`);
      return;
    }

    try {
      await addMutation.mutateAsync({
        groupChatId,
        payload: { agentIds: selected },
      });
      setSelected([]);
      setError(null);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "邀请失败");
    }
  }

  return (
    <MoodmateDialog
      description={`还可以邀请 ${remainingSlots} 位朋友。`}
      footer={
        <>
          <button
            className="moodmate-button moodmate-button--secondary"
            onClick={onClose}
            type="button"
          >
            取消
          </button>
          <button
            className="moodmate-button moodmate-button--primary"
            disabled={addMutation.isPending}
            onClick={() => void handleSubmit()}
            type="button"
          >
            {addMutation.isPending ? "正在邀请" : "邀请"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title="邀请朋友"
    >
      <AgentPicker
        agents={candidates}
        isPending={agentsQuery.isPending}
        onToggle={toggle}
        selected={selected}
      />
      {error ? (
        <p className="moodmate-form-error" role="alert">
          {error}
        </p>
      ) : null}
    </MoodmateDialog>
  );
}

function AgentPicker({
  agents,
  isPending,
  onToggle,
  selected,
}: {
  agents: UserAgent[];
  isPending: boolean;
  onToggle: (agentId: string) => void;
  selected: string[];
}) {
  if (isPending) {
    return <p className="moodmate-picker__state">正在加载朋友</p>;
  }

  if (agents.length === 0) {
    return <p className="moodmate-picker__state">没有可选择的朋友。</p>;
  }

  return (
    <div className="moodmate-picker">
      {agents.map((agent) => {
        const isSelected = selected.includes(agent.id);

        return (
          <button
            aria-pressed={isSelected}
            className="moodmate-picker__item"
            key={agent.id}
            onClick={() => onToggle(agent.id)}
            type="button"
          >
            <MoodmateAvatar
              onSurface
              profile={getMemberProfile(agent)}
              size="xs"
            />
            <span>
              <strong>{agent.name}</strong>
              <small>{agent.headline || "MoodMate 朋友"}</small>
            </span>
            <em>{isSelected ? "已选" : "选择"}</em>
          </button>
        );
      })}
    </div>
  );
}
