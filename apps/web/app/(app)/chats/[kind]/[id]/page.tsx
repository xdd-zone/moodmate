import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChatConversationView } from "@/src/components/chat/chat-workspace";

export const metadata: Metadata = {
  title: "聊天",
};

type ChatPageProps = {
  params: Promise<{ id: string; kind: string }>;
};

export default async function ChatPage({ params }: ChatPageProps) {
  const { id, kind } = await params;

  if (kind !== "direct" && kind !== "group") notFound();

  return (
    <ChatConversationView key={`${kind}:${id}`} selection={{ id, kind }} />
  );
}
