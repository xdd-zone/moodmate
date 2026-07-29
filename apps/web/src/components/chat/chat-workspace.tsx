"use client";

import type {
  AgentGroupChatDetail,
  AgentGroupChatListResponse,
  CompanionConversationResponse,
  WebUserProfile,
} from "@repo/contracts";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { LogOut, PanelLeft, PanelRight, Plus, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { companionConversationQueryOptions } from "@/src/api/chat.query";
import {
  groupChatDetailQueryOptions,
  groupChatsQueryOptions,
} from "@/src/api/group-chat.query";
import { clearClientSession } from "@/src/auth/client-session";
import {
  CreateGroupChatDialog,
  GroupChatInformation,
  GroupChatPane,
} from "@/src/components/group-chat/group-chat-workspace";
import { MoodmateAppShell } from "@/src/components/moodmate/app-shell";
import { MoodmateAvatarMenu } from "@/src/components/moodmate/avatar-menu";
import { MoodmateConversationItem } from "@/src/components/moodmate/conversation-item";
import {
  MoodmateInfoPanel,
  MoodmateInfoSection,
} from "@/src/components/moodmate/info-panel";
import { MoodmateListPanel } from "@/src/components/moodmate/list-panel";
import { MoodmateNavigationRail } from "@/src/components/moodmate/navigation-rail";

import {
  getCompanionProfile,
  getCurrentUserProfile,
  getLatestConversationHref,
  toDirectConversation,
  toGroupConversation,
} from "./chat-models";
import { CompanionChatPane } from "./companion-chat";

export type ChatSelection = { id: string; kind: "direct" | "group" } | null;

type ChatWorkspaceProps = {
  profile: WebUserProfile;
  selection: ChatSelection;
};

export function ChatWorkspace({ profile, selection }: ChatWorkspaceProps) {
  const router = useRouter();
  const conversationQuery = useQuery(companionConversationQueryOptions());
  const groupListQuery = useQuery(groupChatsQueryOptions());
  const selectedGroupId = selection?.kind === "group" ? selection.id : "";
  const groupDetailQuery = useQuery(
    groupChatDetailQueryOptions(selectedGroupId),
  );
  const [search, setSearch] = useState("");
  const [isInformationVisible, setIsInformationVisible] = useState(true);
  const [isMobileListOpen, setIsMobileListOpen] = useState(false);
  const [isMobileInformationOpen, setIsMobileInformationOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  const conversations = useMemo(() => {
    const items = [
      ...(conversationQuery.data
        ? [toDirectConversation(conversationQuery.data)]
        : []),
      ...(groupListQuery.data?.items ?? []).map(toGroupConversation),
    ];
    const query = search.trim().toLocaleLowerCase("zh-CN");

    return query
      ? items.filter((item) =>
          `${item.title} ${item.lastMessage}`
            .toLocaleLowerCase("zh-CN")
            .includes(query),
        )
      : items;
  }, [conversationQuery.data, groupListQuery.data, search]);

  useEffect(() => {
    if (selection || conversationQuery.isPending || groupListQuery.isPending) {
      return;
    }

    const href = getLatestConversationHref(
      conversationQuery.data,
      groupListQuery.data?.items ?? [],
    );

    if (href) router.replace(href);
  }, [
    conversationQuery.data,
    conversationQuery.isPending,
    groupListQuery.data,
    groupListQuery.isPending,
    router,
    selection,
  ]);

  useEffect(() => {
    if (
      selection?.kind === "direct" &&
      conversationQuery.data &&
      selection.id !== conversationQuery.data.conversationId
    ) {
      router.replace(`/chats/direct/${conversationQuery.data.conversationId}`);
    }
  }, [conversationQuery.data, router, selection]);

  const userProfile = getCurrentUserProfile(profile);
  const companionProfile = conversationQuery.data
    ? getCompanionProfile(conversationQuery.data)
    : null;
  const activeId = selection?.id ?? "";

  function handleLogout() {
    clearClientSession();
    window.location.replace("/");
  }

  function handleInformationToggle() {
    if (window.matchMedia("(max-width: 640px)").matches) {
      setIsMobileInformationOpen(true);
      setIsInformationVisible(true);
      return;
    }

    setIsInformationVisible((current) => !current);
  }

  const navigation = (
    <MoodmateNavigationRail
      active="chats"
      profileControl={
        <MoodmateAvatarMenu
          items={[
            {
              href: "/settings",
              icon: Settings,
              label: "个人资料与设置",
            },
            {
              danger: true,
              icon: LogOut,
              label: "退出登录",
              onSelect: handleLogout,
              separatorBefore: true,
            },
          ]}
          label="个人菜单"
          profile={userProfile}
        />
      }
      unreadCount={conversationQuery.data?.hasUnreadCareEvent ? 1 : 0}
    />
  );

  const list = (
    <MoodmateListPanel
      actions={
        <button
          aria-label="新建群聊"
          className="moodmate-icon-button"
          onClick={() => setIsCreateGroupOpen(true)}
          title="新建群聊"
          type="button"
        >
          <Plus aria-hidden="true" />
        </button>
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
      {conversations.map((conversation) => (
        <MoodmateConversationItem
          active={conversation.id === activeId}
          conversation={conversation}
          key={`${conversation.kind}:${conversation.id}`}
          onNavigate={() => setIsMobileListOpen(false)}
        />
      ))}
      {!conversationQuery.isPending &&
      !groupListQuery.isPending &&
      conversations.length === 0 ? (
        <p className="moodmate-list__notice">没有匹配的会话。</p>
      ) : null}
    </MoodmateListPanel>
  );

  const main = renderMainContent({
    companionProfile,
    conversationQuery,
    groupDetailQuery,
    groupListQuery,
    onInformationToggle: handleInformationToggle,
    onOpenList: () => setIsMobileListOpen(true),
    profile: userProfile,
    selection,
  });

  const information = renderInformation({
    companionProfile,
    conversation: conversationQuery.data,
    groupDetail: groupDetailQuery.data,
    onClose: () => setIsMobileInformationOpen(false),
    selection,
  });

  const shellClassName = [
    isMobileListOpen ? "moodmate-app--mobile-list" : "",
    isMobileInformationOpen ? "moodmate-app--mobile-info" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {isInformationVisible && information ? (
        <MoodmateAppShell
          className={shellClassName}
          information={information}
          list={list}
          navigation={navigation}
          variant="has-info"
        >
          {main}
        </MoodmateAppShell>
      ) : (
        <MoodmateAppShell
          className={shellClassName}
          list={list}
          navigation={navigation}
        >
          {main}
        </MoodmateAppShell>
      )}

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
    </>
  );
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
  profile: ReturnType<typeof getCurrentUserProfile>;
  selection: ChatSelection;
}) {
  const mobileActions = {
    onInformationToggle,
    onOpenList,
  };

  if (!selection) {
    const isLoading = conversationQuery.isPending || groupListQuery.isPending;

    return (
      <ChatEmptyState
        description={
          isLoading ? "正在选择最近的会话" : "新建群聊，或从左侧选择一个会话。"
        }
        title={isLoading ? "正在加载聊天" : "还没有可用会话"}
      />
    );
  }

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
  selection,
}: {
  companionProfile: ReturnType<typeof getCompanionProfile> | null;
  conversation: CompanionConversationResponse | undefined;
  groupDetail: AgentGroupChatDetail | undefined;
  onClose: () => void;
  selection: ChatSelection;
}) {
  if (selection?.kind === "group" && groupDetail) {
    return (
      <InformationPanelFrame onClose={onClose}>
        <GroupChatInformation detail={groupDetail} groupChatId={selection.id} />
      </InformationPanelFrame>
    );
  }

  if (selection?.kind === "direct" && conversation && companionProfile) {
    return (
      <InformationPanelFrame onClose={onClose}>
        <MoodmateInfoPanel profile={companionProfile}>
          <MoodmateInfoSection title="关于">
            <p>
              愿意听你慢慢说，不急着给建议。会记住你在意的人和事，
              在你需要时轻轻提起。
            </p>
          </MoodmateInfoSection>
          <MoodmateInfoSection title="关系">
            <p>已经一起聊过 {conversation.messageCount} 条消息。</p>
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
  children: React.ReactNode;
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
