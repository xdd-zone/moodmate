import type { Metadata } from "next";

import { ChatEntryView } from "@/src/components/chat/chat-workspace";

export const metadata: Metadata = {
  title: "聊天",
};

export default function ChatsPage() {
  return <ChatEntryView />;
}
