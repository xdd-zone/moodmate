import type { Metadata } from "next";

import { ChatWorkspaceGuard } from "@/src/components/chat/chat-workspace-guard";

export const metadata: Metadata = {
  title: "聊天",
};

export default function ChatsPage() {
  return <ChatWorkspaceGuard selection={null} />;
}
