"use client";

import type { WebSession, WebUserProfile } from "@repo/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getWebUserProfile } from "@/src/api/user.api";
import {
  clearClientSession,
  readClientSession,
} from "@/src/auth/client-session";
import { CompanionChatApp } from "@/src/components/chat/companion-chat";

interface DashboardState {
  profile: WebUserProfile;
  session: WebSession;
}

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export function WebDashboardGuard() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardState | null>(null);

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

        setDashboard({ profile, session: latestSession.session });
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        clearClientSession();
        router.replace("/");
      }
    }

    void loadProfile();
    return () => abortController.abort();
  }, [router]);

  if (!dashboard) {
    return (
      <main
        aria-busy="true"
        className="grid min-h-svh place-items-center px-5 text-foreground"
      >
        <p className="text-sm text-muted" role="status">
          正在恢复登录状态
        </p>
      </main>
    );
  }

  return (
    <CompanionChatApp profile={dashboard.profile} session={dashboard.session} />
  );
}
