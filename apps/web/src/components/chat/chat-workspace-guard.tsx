"use client";

import type { WebUserProfile } from "@repo/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getWebUserProfile } from "@/src/api/user.api";
import {
  clearClientSession,
  readClientSession,
} from "@/src/auth/client-session";

import { ChatWorkspace, type ChatSelection } from "./chat-workspace";

type ChatWorkspaceGuardProps = {
  selection: ChatSelection;
};

type ChatSessionState = {
  profile: WebUserProfile;
};

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export function ChatWorkspaceGuard({ selection }: ChatWorkspaceGuardProps) {
  const router = useRouter();
  const [chatSession, setChatSession] = useState<ChatSessionState | null>(null);

  useEffect(() => {
    const storedSession = readClientSession();

    if (!storedSession) {
      router.replace("/");
      return;
    }

    const abortController = new AbortController();

    async function loadProfile() {
      try {
        const profile = await getWebUserProfile({
          init: { signal: abortController.signal },
        });
        const latestSession = readClientSession();

        if (!latestSession) {
          router.replace("/");
          return;
        }

        setChatSession({ profile });
      } catch (error) {
        if (isAbortError(error)) return;

        clearClientSession();
        router.replace("/");
      }
    }

    void loadProfile();
    return () => abortController.abort();
  }, [router]);

  if (!chatSession) {
    return (
      <main aria-busy="true" className="moodmate moodmate-chat-state">
        <p role="status">正在恢复登录状态</p>
      </main>
    );
  }

  const selectionKey = selection
    ? `${selection.kind}:${selection.id}`
    : "entry";

  return (
    <ChatWorkspace
      key={selectionKey}
      profile={chatSession.profile}
      selection={selection}
    />
  );
}
