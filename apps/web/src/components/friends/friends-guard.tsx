"use client";

import type { WebUserProfile } from "@repo/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getWebUserProfile } from "@/src/api/user.api";
import {
  clearClientSession,
  readClientSession,
} from "@/src/auth/client-session";

import { FriendDetail } from "./friend-detail";
import { FriendsList } from "./friends-list";

type FriendsGuardProps = {
  friendId?: string;
};

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export function FriendsGuard({ friendId }: FriendsGuardProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<WebUserProfile | null>(null);

  useEffect(() => {
    if (!readClientSession()) {
      router.replace("/");
      return;
    }

    const abortController = new AbortController();

    async function loadProfile() {
      try {
        const nextProfile = await getWebUserProfile({
          init: { signal: abortController.signal },
        });

        if (!readClientSession()) {
          router.replace("/");
          return;
        }

        setProfile(nextProfile);
      } catch (error) {
        if (isAbortError(error)) return;

        clearClientSession();
        router.replace("/");
      }
    }

    void loadProfile();
    return () => abortController.abort();
  }, [router]);

  if (!profile) {
    return (
      <main aria-busy="true" className="moodmate moodmate-chat-state">
        <p role="status">正在恢复登录状态</p>
      </main>
    );
  }

  return friendId ? (
    <FriendDetail friendId={friendId} profile={profile} />
  ) : (
    <FriendsList profile={profile} />
  );
}
