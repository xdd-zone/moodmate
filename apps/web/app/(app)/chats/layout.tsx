import type { ReactNode } from "react";

import { ChatWorkspaceLayout } from "@/src/components/chat/chat-workspace";

type ChatsLayoutProps = {
  children: ReactNode;
};

export default function ChatsLayout({ children }: ChatsLayoutProps) {
  return <ChatWorkspaceLayout>{children}</ChatWorkspaceLayout>;
}
