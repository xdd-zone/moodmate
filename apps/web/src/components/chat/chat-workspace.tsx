"use client";

import type {
  AgentGroupChatDetail,
  AgentGroupChatListResponse,
  CompanionConversationResponse,
} from "@repo/contracts";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  Archive,
  BellOff,
  Brain,
  CircleX,
  Images,
  Info,
  LogOut,
  MessageCirclePlus,
  MessageSquareDot,
  PanelLeft,
  PanelRight,
  Pin,
  Plus,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { companionConversationQueryOptions } from "@/src/api/chat.query";
import {
  groupChatDetailQueryOptions,
  groupChatsQueryOptions,
} from "@/src/api/group-chat.query";
import { useAuthenticatedApp } from "@/src/components/app/authenticated-app-layout";
import {
  CreateGroupChatDialog,
  GroupChatInformation,
  GroupChatPane,
} from "@/src/components/group-chat/group-chat-workspace";
import { classNames } from "@/src/components/moodmate/class-names";
import { MoodmateConversationItem } from "@/src/components/moodmate/conversation-item";
import type { MoodmateConversationMenuItem } from "@/src/components/moodmate/conversation-menu";
import {
  MoodmateInfoPanel,
  MoodmateInfoSection,
} from "@/src/components/moodmate/info-panel";
import { MoodmateListPanel } from "@/src/components/moodmate/list-panel";
import type {
  MoodmateConversation,
  MoodmateProfile,
} from "@/src/components/moodmate/models";
import { MoodmateToast } from "@/src/components/moodmate/toast";

import {
  getCompanionProfile,
  getLatestConversationHref,
  toDirectConversation,
  toGroupConversation,
} from "./chat-models";
import { CompanionChatPane, getRelationshipStageLabel } from "./companion-chat";
import {
  getConversationKey,
  useConversationPreferences,
  type ConversationPreferences,
} from "./conversation-preferences";

export type ChatSelection = { id: string; kind: "direct" | "group" };

type ChatWorkspaceLayoutProps = {
  children: ReactNode;
};

type InformationRequest = {
  key: string;
  token: number;
};

type ChatToast = {
  action?: {
    label: string;
    onClick: () => void;
  };
  id: number;
  message: string;
};

type ChatWorkspaceContextValue = {
  closeMobileList: () => void;
  conversationQuery: UseQueryResult<CompanionConversationResponse>;
  groupListQuery: UseQueryResult<AgentGroupChatListResponse>;
  informationRequest: InformationRequest | null;
  openMobileList: () => void;
  userProfile: MoodmateProfile;
};

const ChatWorkspaceContext = createContext<ChatWorkspaceContextValue | null>(
  null,
);

export function ChatWorkspaceLayout({ children }: ChatWorkspaceLayoutProps) {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const { userProfile } = useAuthenticatedApp();
  const conversationQuery = useQuery(companionConversationQueryOptions());
  const groupListQuery = useQuery(groupChatsQueryOptions());
  const { preferences, restoreArchived, updatePreference } =
    useConversationPreferences();
  const [search, setSearch] = useState("");
  const [isMobileListOpen, setIsMobileListOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [informationRequest, setInformationRequest] =
    useState<InformationRequest | null>(null);
  const [toast, setToast] = useState<ChatToast | null>(null);
  const toastIdRef = useRef(0);
  const activeId = Array.isArray(params.id)
    ? (params.id[0] ?? "")
    : (params.id ?? "");
  const allConversations = useMemo(
    () => [
      ...(conversationQuery.data
        ? [toDirectConversation(conversationQuery.data)]
        : []),
      ...(groupListQuery.data?.items ?? []).map(toGroupConversation),
    ],
    [conversationQuery.data, groupListQuery.data],
  );
  const conversations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("zh-CN");

    return query
      ? allConversations.filter((item) =>
          `${item.title} ${item.lastMessage}`
            .toLocaleLowerCase("zh-CN")
            .includes(query),
        )
      : allConversations;
  }, [allConversations, search]);
  const visibleConversations = useMemo(
    () => applyConversationPreferences(conversations, preferences),
    [conversations, preferences],
  );
  const archivedCount = useMemo(
    () =>
      allConversations.filter(
        (conversation) =>
          preferences[getConversationKey(conversation)]?.archived,
      ).length,
    [allConversations, preferences],
  );
  const closeMobileList = useCallback(() => setIsMobileListOpen(false), []);
  const openMobileList = useCallback(() => setIsMobileListOpen(true), []);
  const requestInformation = useCallback((key: string) => {
    setInformationRequest((current) => ({
      key,
      token: (current?.token ?? 0) + 1,
    }));
  }, []);
  const showToast = useCallback(
    (message: string, action?: ChatToast["action"]) => {
      toastIdRef.current += 1;
      setToast({ action, id: toastIdRef.current, message });
    },
    [],
  );
  const contextValue = useMemo(
    () => ({
      closeMobileList,
      conversationQuery,
      groupListQuery,
      informationRequest,
      openMobileList,
      userProfile,
    }),
    [
      closeMobileList,
      conversationQuery,
      groupListQuery,
      informationRequest,
      openMobileList,
      userProfile,
    ],
  );

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(null), 3200);

    return () => window.clearTimeout(timer);
  }, [toast]);

  function createMenuItems(
    conversation: MoodmateConversation,
  ): MoodmateConversationMenuItem[] {
    const key = getConversationKey(conversation);
    const isGroup = conversation.kind === "group";
    const isPinned = Boolean(conversation.pinned);
    const isMuted = Boolean(conversation.muted);
    const isUnread = Boolean(conversation.unreadCount);

    return [
      {
        href: conversation.href,
        icon: Info,
        label: isGroup ? "查看群资料" : "查看朋友资料",
        onSelect: () => requestInformation(key),
      },
      {
        checked: isPinned,
        icon: Pin,
        label: "置顶对话",
        onSelect: () => {
          updatePreference(key, { pinned: !isPinned });
          showToast(
            isPinned
              ? `已取消置顶「${conversation.title}」`
              : `已置顶「${conversation.title}」`,
          );
        },
        stateLabel: "已开启",
      },
      {
        checked: isMuted,
        icon: BellOff,
        label: "消息免打扰",
        onSelect: () => {
          updatePreference(key, { muted: !isMuted });
          showToast(
            isMuted
              ? `已关闭「${conversation.title}」的消息免打扰`
              : `已开启「${conversation.title}」的消息免打扰`,
          );
        },
        stateLabel: "已开启",
      },
      {
        checked: isUnread,
        icon: MessageSquareDot,
        label: isUnread ? "标为已读" : "标为未读",
        onSelect: () => {
          updatePreference(key, { unread: !isUnread });
          showToast(
            isUnread
              ? `已将「${conversation.title}」标为已读`
              : `已将「${conversation.title}」标为未读`,
          );
        },
        stateLabel: "已标记",
      },
      {
        icon: Archive,
        label: "归档对话",
        onSelect: () => {
          updatePreference(key, { archived: true });
          showToast(`已归档「${conversation.title}」`, {
            label: "撤销",
            onClick: () => {
              updatePreference(key, { archived: false });
              setToast(null);
            },
          });
        },
        separatorBefore: true,
      },
      {
        disabled: true,
        icon: CircleX,
        label: "清空聊天记录",
        separatorBefore: true,
        title: "清空聊天记录暂未开放",
      },
      {
        danger: true,
        disabled: true,
        icon: LogOut,
        label: isGroup ? "退出群聊" : "结束这段陪伴",
        title: isGroup ? "退出群聊暂未开放" : "结束这段陪伴暂未开放",
      },
    ];
  }

  const list = (
    <MoodmateListPanel
      actions={
        <>
          <Link
            aria-label="新对话"
            className="moodmate-icon-button"
            href="/friends"
            title="新对话"
          >
            <MessageCirclePlus aria-hidden="true" />
          </Link>
          <button
            aria-label="新建群聊"
            className="moodmate-icon-button"
            onClick={() => setIsCreateGroupOpen(true)}
            title="新建群聊"
            type="button"
          >
            <Plus aria-hidden="true" />
          </button>
        </>
      }
      searchInput={{
        "aria-label": "搜索会话",
        onChange: (event) => setSearch(event.currentTarget.value),
        placeholder: "搜索对话、朋友",
        value: search,
      }}
      sectionLabel="全部对话"
      title="聊天"
    >
      {conversationQuery.isError ? (
        <p className="moodmate-list__notice" role="alert">
          单聊加载失败，可继续使用群聊。
        </p>
      ) : null}
      {groupListQuery.isError ? (
        <p className="moodmate-list__notice" role="alert">
          群聊列表加载失败，可继续使用单聊。
        </p>
      ) : null}
      {conversationQuery.isPending || groupListQuery.isPending ? (
        <p className="moodmate-list__notice" role="status">
          正在加载会话
        </p>
      ) : null}
      {visibleConversations.map((conversation) => (
        <MoodmateConversationItem
          active={conversation.id === activeId}
          conversation={conversation}
          key={getConversationKey(conversation)}
          menuItems={createMenuItems(conversation)}
          menuLabel={`${conversation.title}的会话菜单`}
          onNavigate={closeMobileList}
        />
      ))}
      {!conversationQuery.isPending &&
      !groupListQuery.isPending &&
      visibleConversations.length === 0 ? (
        <p className="moodmate-list__notice">没有匹配的会话。</p>
      ) : null}
      {archivedCount > 0 ? (
        <button
          className="moodmate-list__notice moodmate-list__notice--action"
          onClick={restoreArchived}
          type="button"
        >
          已归档 {archivedCount} 个会话，点这里全部恢复
        </button>
      ) : null}
    </MoodmateListPanel>
  );

  return (
    <ChatWorkspaceContext.Provider value={contextValue}>
      <div
        className={classNames(
          "moodmate-chat-workspace",
          isMobileListOpen && "moodmate-chat-workspace--mobile-list",
        )}
      >
        <aside className="moodmate-list">{list}</aside>
        <div className="moodmate-chat-workspace__content">{children}</div>
      </div>

      {toast ? (
        <MoodmateToast
          action={toast.action}
          key={toast.id}
          message={toast.message}
        />
      ) : null}

      {isCreateGroupOpen ? (
        <CreateGroupChatDialog
          onClose={() => setIsCreateGroupOpen(false)}
          onCreated={(groupChatId) => {
            setIsCreateGroupOpen(false);
            router.push(`/chats/group/${groupChatId}`);
          }}
          open
        />
      ) : null}
    </ChatWorkspaceContext.Provider>
  );
}

export function ChatEntryView() {
  const router = useRouter();
  const { conversationQuery, groupListQuery } = useChatWorkspace();
  const isLoading = conversationQuery.isPending || groupListQuery.isPending;

  useEffect(() => {
    if (isLoading) return;

    const href = getLatestConversationHref(
      conversationQuery.data,
      groupListQuery.data?.items ?? [],
    );

    if (href) router.replace(href);
  }, [conversationQuery.data, groupListQuery.data, isLoading, router]);

  return (
    <div className="moodmate-chat-view">
      <div className="moodmate-main">
        <ChatEmptyState
          description={
            isLoading
              ? "正在选择最近的会话"
              : "新建群聊，或从左侧选择一个会话。"
          }
          title={isLoading ? "正在加载聊天" : "还没有可用会话"}
        />
      </div>
    </div>
  );
}

type ChatConversationViewProps = {
  selection: ChatSelection;
};

export function ChatConversationView({ selection }: ChatConversationViewProps) {
  const router = useRouter();
  const {
    conversationQuery,
    groupListQuery,
    informationRequest,
    openMobileList,
    userProfile,
  } = useChatWorkspace();
  const selectedGroupId = selection.kind === "group" ? selection.id : "";
  const groupDetailQuery = useQuery(
    groupChatDetailQueryOptions(selectedGroupId),
  );
  const [isInformationVisible, setIsInformationVisible] = useState(false);
  const [isMobileInformationOpen, setIsMobileInformationOpen] = useState(false);
  const companionProfile = conversationQuery.data
    ? getCompanionProfile(conversationQuery.data)
    : null;

  useEffect(() => {
    if (
      selection.kind === "direct" &&
      conversationQuery.data &&
      selection.id !== conversationQuery.data.conversationId
    ) {
      router.replace(`/chats/direct/${conversationQuery.data.conversationId}`);
    }
  }, [conversationQuery.data, router, selection]);

  useEffect(() => {
    if (informationRequest?.key !== `${selection.kind}:${selection.id}`) return;

    setIsInformationVisible(true);

    if (window.matchMedia("(max-width: 1100px)").matches) {
      setIsMobileInformationOpen(true);
    }
  }, [informationRequest, selection]);

  function handleInformationToggle() {
    if (window.matchMedia("(max-width: 1100px)").matches) {
      setIsInformationVisible(true);
      setIsMobileInformationOpen(true);
      return;
    }

    setIsInformationVisible((current) => !current);
  }

  function closeInformation() {
    setIsInformationVisible(false);
    setIsMobileInformationOpen(false);
  }

  const main = renderMainContent({
    companionProfile,
    conversationQuery,
    groupDetailQuery,
    groupListQuery,
    onInformationToggle: handleInformationToggle,
    onOpenList: openMobileList,
    profile: userProfile,
    selection,
  });
  const information = renderInformation({
    companionProfile,
    conversation: conversationQuery.data,
    groupDetail: groupDetailQuery.data,
    onClose: closeInformation,
    profile: userProfile,
    selection,
  });
  const showInformation = isInformationVisible && information;

  return (
    <div
      className={classNames(
        "moodmate-chat-view",
        showInformation && "moodmate-chat-view--has-info",
        isMobileInformationOpen && "moodmate-chat-view--mobile-info",
      )}
    >
      <div className="moodmate-main">{main}</div>
      {showInformation ? (
        <aside className="moodmate-info">{information}</aside>
      ) : null}
    </div>
  );
}

function useChatWorkspace() {
  const context = useContext(ChatWorkspaceContext);

  if (!context) {
    throw new Error("聊天页面必须在聊天布局内使用");
  }

  return context;
}

/**
 * 把本地偏好套到服务端会话上：去掉归档项、覆盖免打扰和未读、置顶项排到最前。
 */
function applyConversationPreferences(
  conversations: readonly MoodmateConversation[],
  preferences: ConversationPreferences,
): MoodmateConversation[] {
  const visible: MoodmateConversation[] = [];

  for (const conversation of conversations) {
    const preference = preferences[getConversationKey(conversation)];

    if (preference?.archived) continue;

    visible.push(
      preference
        ? {
            ...conversation,
            muted: preference.muted ?? conversation.muted,
            pinned: preference.pinned ?? false,
            unreadCount: getUnreadCount(conversation, preference.unread),
          }
        : conversation,
    );
  }

  return visible.sort(
    (first, second) =>
      Number(second.pinned ?? false) - Number(first.pinned ?? false),
  );
}

function getUnreadCount(
  conversation: MoodmateConversation,
  unread: boolean | undefined,
) {
  if (unread === undefined) return conversation.unreadCount;

  return unread ? Math.max(conversation.unreadCount ?? 0, 1) : 0;
}

function renderMainContent({
  companionProfile,
  conversationQuery,
  groupDetailQuery,
  groupListQuery,
  onInformationToggle,
  onOpenList,
  profile,
  selection,
}: {
  companionProfile: ReturnType<typeof getCompanionProfile> | null;
  conversationQuery: UseQueryResult<CompanionConversationResponse>;
  groupDetailQuery: UseQueryResult<AgentGroupChatDetail>;
  groupListQuery: UseQueryResult<AgentGroupChatListResponse>;
  onInformationToggle: () => void;
  onOpenList: () => void;
  profile: MoodmateProfile;
  selection: ChatSelection;
}) {
  const mobileActions = {
    onInformationToggle,
    onOpenList,
  };

  if (selection.kind === "direct") {
    if (conversationQuery.isPending) {
      return <ChatEmptyState description="请稍候" title="正在加载单聊" />;
    }

    if (
      conversationQuery.isError ||
      !conversationQuery.data ||
      !companionProfile
    ) {
      return (
        <ChatEmptyState
          description="请确认 API 已运行，然后重新加载页面。"
          title="单聊加载失败"
        />
      );
    }

    return (
      <CompanionChatPane
        assistantProfile={companionProfile}
        key={conversationQuery.data.conversationId}
        profile={profile}
        serverConversation={conversationQuery.data}
        {...mobileActions}
      />
    );
  }

  if (
    !groupListQuery.isPending &&
    !groupListQuery.isError &&
    !groupListQuery.data?.items.some((group) => group.id === selection.id)
  ) {
    return (
      <ChatEmptyState
        description="这个群聊不存在，或已经被删除。"
        title="找不到群聊"
      />
    );
  }

  if (groupDetailQuery.isPending) {
    return <ChatEmptyState description="请稍候" title="正在加载群聊" />;
  }

  if (groupDetailQuery.isError || !groupDetailQuery.data) {
    return (
      <ChatEmptyState
        description="群聊详情加载失败，请稍后重新加载。"
        title="无法打开群聊"
      />
    );
  }

  return (
    <GroupChatPane
      detail={groupDetailQuery.data}
      groupChatId={selection.id}
      profile={profile}
      {...mobileActions}
    />
  );
}

function renderInformation({
  companionProfile,
  conversation,
  groupDetail,
  onClose,
  profile,
  selection,
}: {
  companionProfile: ReturnType<typeof getCompanionProfile> | null;
  conversation: CompanionConversationResponse | undefined;
  groupDetail: AgentGroupChatDetail | undefined;
  onClose: () => void;
  profile: MoodmateProfile;
  selection: ChatSelection;
}) {
  if (selection.kind === "group" && groupDetail) {
    return (
      <InformationPanelFrame onClose={onClose}>
        <GroupChatInformation
          detail={groupDetail}
          groupChatId={selection.id}
          profile={profile}
        />
      </InformationPanelFrame>
    );
  }

  if (selection.kind === "direct" && conversation && companionProfile) {
    return (
      <InformationPanelFrame onClose={onClose}>
        <MoodmateInfoPanel
          actions={
            <>
              <Link
                className="moodmate-button moodmate-button--secondary"
                href="/friends"
              >
                <UserRound aria-hidden="true" />
                查看详情
              </Link>
              <button
                className="moodmate-button moodmate-button--secondary"
                disabled
                title="消息免打扰暂未开放"
                type="button"
              >
                <BellOff aria-hidden="true" />
                静音
              </button>
            </>
          }
          profile={companionProfile}
        >
          <MoodmateInfoSection title="简介">
            <p>
              愿意听你慢慢说，不急着给建议。会记住你在意的人和事，
              在你需要时轻轻提起。
            </p>
          </MoodmateInfoSection>
          <MoodmateInfoSection title="关系阶段">
            <div className="moodmate-info-stat">
              <span className="moodmate-relationship-pill">
                {getRelationshipStageLabel(conversation.messageCount)}
              </span>
              <p>共 {conversation.messageCount} 条对话</p>
            </div>
          </MoodmateInfoSection>
          <MoodmateInfoSection title="关于 TA 记得的">
            <Link className="moodmate-info-link" href="/settings">
              <Brain aria-hidden="true" />
              在设置中查看记忆
            </Link>
          </MoodmateInfoSection>
          <MoodmateInfoSection title="共享媒体">
            <p className="moodmate-info-empty">
              <Images aria-hidden="true" />
              暂时没有共享媒体
            </p>
          </MoodmateInfoSection>
        </MoodmateInfoPanel>
      </InformationPanelFrame>
    );
  }

  return null;
}

function InformationPanelFrame({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="moodmate-info-frame">
      <button
        aria-label="返回聊天"
        className="moodmate-info-frame__close moodmate-icon-button"
        onClick={onClose}
        title="返回聊天"
        type="button"
      >
        <PanelLeft aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}

function ChatEmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <section className="moodmate-chat-state">
      <div>
        <PanelRight aria-hidden="true" />
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}
