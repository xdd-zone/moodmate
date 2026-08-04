"use client";

import type {
  AgentGroupChatDetail,
  AgentGroupChatMember,
  AgentGroupChatMessage,
  Agent,
} from "@repo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  BellOff,
  Clock3,
  Edit3,
  LoaderCircle,
  MoreVertical,
  PanelLeft,
  PanelRight,
  Search,
  Send,
  Smile,
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
import { classNames } from "@/src/components/moodmate/class-names";
import { MoodmateDialog } from "@/src/components/moodmate/dialog";
import {
  MoodmateInfoPanel,
  MoodmateInfoSection,
} from "@/src/components/moodmate/info-panel";
import type { MoodmateProfile } from "@/src/components/moodmate/models";

import {
  ChatDateDivider,
  ChatHeaderTyping,
  ChatTypingDots,
  CopyMessageButton,
  formatMessageTime,
  isSameLocalDate,
} from "@/src/components/chat/chat-message-details";
import { FriendAvatarMenu } from "@/src/components/chat/friend-avatar-menu";

import {
  MentionTextarea,
  type MentionTextareaHandle,
} from "./mention-textarea";

const MAX_MEMBERS = 6;
const RECENT_MESSAGES_LIMIT = 50;

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
  const mentionTextareaRef = useRef<MentionTextareaHandle>(null);
  const activeMembers = detail.members.filter(
    (member) => member.status === "active",
  );
  const totalMemberCount = activeMembers.length + 1;
  const groupProfile = {
    ...getGroupProfile(detail.groupChat),
    headline: `${totalMemberCount} 位成员`,
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
          {sendMutation.isPending ? (
            <ChatHeaderTyping label="朋友正在输入" />
          ) : (
            <p>{totalMemberCount} 位成员</p>
          )}
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
              detail.recentMessages.map((message, index) => {
                const previousMessage = detail.recentMessages[index - 1];
                const startsNewDay =
                  !previousMessage ||
                  !isSameLocalDate(
                    previousMessage.createdAtMs,
                    message.createdAtMs,
                  );

                return (
                  <div className="moodmate-message-row" key={message.id}>
                    {startsNewDay ? (
                      <ChatDateDivider createdAtMs={message.createdAtMs} />
                    ) : null}
                    <GroupMessage
                      groupProfile={groupProfile}
                      isStacked={
                        !startsNewDay &&
                        isSameGroupSender(previousMessage, message)
                      }
                      message={message}
                      member={activeMembers.find(
                        (member) => member.agentId === message.agentId,
                      )}
                      onMention={(member) =>
                        mentionTextareaRef.current?.insertMention(member)
                      }
                      userProfile={profile}
                    />
                  </div>
                );
              })
            )}
            {sendMutation.isPending ? (
              <div className="moodmate-message moodmate-message--incoming moodmate-message--stacked">
                <span
                  aria-hidden="true"
                  className="moodmate-message__avatar-placeholder"
                />
                <div className="moodmate-message__typing">
                  <ChatTypingDots label="朋友正在回复" />
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="moodmate-group-composer">
          <p>
            <AtSign aria-hidden="true" />
            输入 @ 可指定某位朋友优先回复
          </p>
          <div className="moodmate-group-composer__box">
            <button
              aria-label="表情暂未开放"
              className="moodmate-composer__tool"
              disabled
              title="表情暂未开放"
              type="button"
            >
              <Smile aria-hidden="true" />
            </button>
            <MentionTextarea
              disabled={sendMutation.isPending}
              members={activeMembers}
              onChange={setDraft}
              onSend={handleSend}
              ref={mentionTextareaRef}
              value={draft}
            />
            <button
              aria-label="提及朋友"
              className="moodmate-composer__tool"
              disabled={sendMutation.isPending}
              onClick={() => mentionTextareaRef.current?.insertMention()}
              title="提及朋友"
              type="button"
            >
              <AtSign aria-hidden="true" />
            </button>
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
  isStacked,
  message,
  member,
  onMention,
  userProfile,
}: {
  groupProfile: MoodmateProfile;
  isStacked: boolean;
  message: AgentGroupChatMessage;
  member: AgentGroupChatMember | undefined;
  onMention: (member: AgentGroupChatMember) => void;
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
      className={classNames(
        "moodmate-message",
        isUser ? "moodmate-message--outgoing" : "moodmate-message--incoming",
        isStacked && "moodmate-message--stacked",
      )}
    >
      {isStacked ? (
        <span
          aria-hidden="true"
          className="moodmate-message__avatar-placeholder"
        />
      ) : isUser ? (
        <MoodmateAvatar profile={senderProfile} size="sm" />
      ) : (
        <FriendAvatarMenu
          onMention={member ? () => onMention(member) : undefined}
          onSurface
          profile={senderProfile}
          profileHref={
            message.agentId ? `/friends/${message.agentId}` : undefined
          }
          size="sm"
        />
      )}
      <div className="moodmate-message__content">
        {!isUser && !isStacked ? (
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
          <time dateTime={new Date(message.createdAtMs).toISOString()}>
            {formatMessageTime(message.createdAtMs)}
          </time>
        </div>
        <div className="moodmate-message__feedback">
          <CopyMessageButton text={message.content} />
        </div>
      </div>
    </div>
  );
}

function isSameGroupSender(
  previousMessage: AgentGroupChatMessage | undefined,
  message: AgentGroupChatMessage,
): boolean {
  if (!previousMessage || previousMessage.senderType !== message.senderType) {
    return false;
  }

  if (message.senderType === "agent") {
    return previousMessage.agentId === message.agentId;
  }

  return message.senderType !== "system";
}

export function GroupChatInformation({
  detail,
  groupChatId,
  profile,
}: {
  detail: AgentGroupChatDetail;
  groupChatId: string;
  profile: MoodmateProfile;
}) {
  const queryClient = useQueryClient();
  const removeMutation = useMutation(
    removeGroupChatMemberMutationOptions(queryClient),
  );
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const activeMembers = detail.members.filter(
    (member) => member.status === "active",
  );
  const totalMemberCount = activeMembers.length + 1;
  const groupProfile = {
    ...getGroupProfile(detail.groupChat),
    headline: `${totalMemberCount} 位成员`,
  };

  async function handleRemove(member: AgentGroupChatMember) {
    if (!window.confirm(`确认移除成员「${member.name}」？`)) return;

    await removeMutation.mutateAsync({ groupChatId, memberId: member.id });
  }

  return (
    <>
      <MoodmateInfoPanel
        actions={
          <>
            <button
              className="moodmate-button moodmate-button--secondary"
              disabled
              title="群聊静音暂未开放"
              type="button"
            >
              <BellOff aria-hidden="true" />
              静音
            </button>
            <button
              className="moodmate-button moodmate-button--secondary"
              disabled
              title="编辑群组暂未开放"
              type="button"
            >
              <Edit3 aria-hidden="true" />
              编辑群组
            </button>
          </>
        }
        isGroup
        profile={groupProfile}
      >
        <MoodmateInfoSection title="群简介">
          <p>
            {detail.groupChat.summary?.trim() ||
              "和几位朋友一起聊聊，每个人都会从自己的角度回应。"}
          </p>
        </MoodmateInfoSection>
        <MoodmateInfoSection title={`成员 · ${totalMemberCount}`}>
          <div className="moodmate-member-list">
            {activeMembers.map((member) => (
              <div className="moodmate-member" key={member.id}>
                <FriendAvatarMenu
                  onRemove={() => void handleRemove(member)}
                  onSurface
                  profile={getMemberProfile(member)}
                  profileHref={`/friends/${member.agentId}`}
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
            <div className="moodmate-member">
              <MoodmateAvatar onSurface profile={profile} size="xs" />
              <div>
                <strong>
                  {profile.name}
                  <span className="moodmate-member__role">群主</span>
                </strong>
                <span>你</span>
              </div>
            </div>
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
        <MoodmateInfoSection title="群设置">
          <div className="moodmate-info-setting">
            <BellOff aria-hidden="true" />
            <span>消息免打扰</span>
            <button
              aria-checked="false"
              aria-label="消息免打扰暂未开放"
              className="moodmate-settings-switch"
              disabled
              role="switch"
              type="button"
            />
          </div>
          <div className="moodmate-info-setting">
            <Clock3 aria-hidden="true" />
            <span>朋友依次发言</span>
            <button
              aria-checked="true"
              aria-label="朋友依次发言"
              className="moodmate-settings-switch moodmate-settings-switch--checked"
              disabled
              role="switch"
              type="button"
            />
          </div>
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
  agents: Agent[];
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
