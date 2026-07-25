import type { Metadata } from "next";

import { GroupChatsGuard } from "@/src/components/group-chat/group-chats-guard";

export const metadata: Metadata = {
  title: "群聊",
};

export default function GroupChatsPage() {
  return <GroupChatsGuard />;
}
