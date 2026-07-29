"use client";

import type { WebSession, WebUserProfile } from "@repo/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getWebUserProfile } from "@/src/api/user.api";
import {
  clearClientSession,
  readClientSession,
} from "@/src/auth/client-session";

import { SettingsWorkspace } from "./settings-workspace";

type SettingsSession = {
  profile: WebUserProfile;
  session: WebSession;
};

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export function SettingsGuard() {
  const router = useRouter();
  const [settingsSession, setSettingsSession] =
    useState<SettingsSession | null>(null);

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

        setSettingsSession({
          profile,
          session: latestSession.session,
        });
      } catch (error) {
        if (isAbortError(error)) return;

        clearClientSession();
        router.replace("/");
      }
    }

    void loadProfile();
    return () => abortController.abort();
  }, [router]);

  if (!settingsSession) {
    return (
      <main aria-busy="true" className="moodmate moodmate-chat-state">
        <p role="status">正在恢复登录状态</p>
      </main>
    );
  }

  return <SettingsWorkspace {...settingsSession} />;
}
