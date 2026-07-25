import type {
  AgentGroupChatDetail,
  AgentGroupChatListItem,
  AgentGroupChatMember,
  AgentGroupChatMessage,
} from "@repo/contracts";

import type {
  GroupChatListRow,
  GroupChatMemberWithAgentRow,
  GroupChatMessageWithAgentRow,
} from "./group-chat.repository";

export function presentListItem(row: GroupChatListRow): AgentGroupChatListItem {
  return {
    createdAtMs: row.createdAtMs,
    id: row.id,
    lastMessageAtMs: row.lastMessageAtMs,
    memberCount: row.memberCount,
    messageCount: row.messageCount,
    summary: row.summary,
    title: row.title,
    updatedAtMs: row.updatedAtMs,
  };
}

export function presentMember(
  row: GroupChatMemberWithAgentRow,
): AgentGroupChatMember {
  return {
    agentId: row.agentId,
    displayOrder: row.displayOrder,
    headline: row.headline,
    id: row.id,
    imageKey: row.imageKey,
    joinedAtMs: row.joinedAtMs,
    name: row.name,
    status: row.status,
  };
}

export function presentMessage(
  row: GroupChatMessageWithAgentRow,
): AgentGroupChatMessage {
  return {
    agentId: row.agentId,
    agentImageKey: row.senderType === "agent" ? row.agentImageKey : null,
    agentName: row.senderType === "agent" ? row.agentName : null,
    content: row.content,
    createdAtMs: row.createdAtMs,
    groupChatId: row.groupChatId,
    id: row.id,
    senderType: row.senderType,
    status: row.status,
    turnIndex: row.turnIndex,
  };
}

export function presentDetail(input: {
  groupChat: GroupChatListRow;
  members: GroupChatMemberWithAgentRow[];
  recentMessages: GroupChatMessageWithAgentRow[];
}): AgentGroupChatDetail {
  return {
    groupChat: presentListItem(input.groupChat),
    members: input.members.map(presentMember),
    recentMessages: input.recentMessages.map(presentMessage),
  };
}
