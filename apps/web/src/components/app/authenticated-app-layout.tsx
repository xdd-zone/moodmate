"use client";

import type { WebUserProfile } from "@repo/contracts";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { companionConversationQueryOptions } from "@/src/api/chat.query";
import { getWebUserProfile } from "@/src/api/user.api";
import {
  clearClientSession,
  readClientSession,
} from "@/src/auth/client-session";
import { MoodmateAppShell } from "@/src/components/moodmate/app-shell";
import { MoodmateAvatarMenu } from "@/src/components/moodmate/avatar-menu";
import {
  getMoodmateAvatarPalette,
  type MoodmateProfile,
} from "@/src/components/moodmate/models";
import {
  MoodmateNavigationRail,
  type MoodmateNavigationKey,
} from "@/src/components/moodmate/navigation-rail";

type AuthenticatedAppLayoutProps = {
  children: ReactNode;
};

type AuthenticatedAppContextValue = {
  logout: () => void;
  profile: WebUserProfile;
  userProfile: MoodmateProfile;
};

const AuthenticatedAppContext =
  createContext<AuthenticatedAppContextValue | null>(null);

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function getActiveNavigation(pathname: string): MoodmateNavigationKey {
  if (pathname.startsWith("/friends")) return "friends";
  if (pathname.startsWith("/settings")) return "settings";

  return "chats";
}

export function AuthenticatedAppLayout({
  children,
}: AuthenticatedAppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<WebUserProfile | null>(null);
  const isChatsRoute = pathname.startsWith("/chats");
  const unreadConversationQuery = useQuery({
    ...companionConversationQueryOptions(),
    enabled: profile !== null && isChatsRoute,
    select: (conversation) => conversation.hasUnreadCareEvent,
  });
  const logout = useCallback(() => {
    clearClientSession();
    window.location.replace("/");
  }, []);

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

  const contextValue = useMemo<AuthenticatedAppContextValue | null>(() => {
    if (!profile) return null;

    return {
      logout,
      profile,
      userProfile: {
        headline: profile.email,
        id: profile.userId,
        name: profile.displayName,
        palette: getMoodmateAvatarPalette(profile.userId),
      },
    };
  }, [logout, profile]);

  if (!contextValue) {
    return (
      <main aria-busy="true" className="moodmate moodmate-chat-state">
        <p role="status">正在恢复登录状态</p>
      </main>
    );
  }

  return (
    <AuthenticatedAppContext.Provider value={contextValue}>
      <MoodmateAppShell
        navigation={
          <MoodmateNavigationRail
            active={getActiveNavigation(pathname)}
            profileControl={
              <MoodmateAvatarMenu
                items={[
                  {
                    href: "/settings",
                    icon: Settings,
                    label: "个人资料与设置",
                  },
                  {
                    danger: true,
                    icon: LogOut,
                    label: "退出登录",
                    onSelect: contextValue.logout,
                    separatorBefore: true,
                  },
                ]}
                label="个人菜单"
                profile={contextValue.userProfile}
              />
            }
            unreadCount={unreadConversationQuery.data ? 1 : 0}
          />
        }
        variant="no-list"
      >
        {children}
      </MoodmateAppShell>
    </AuthenticatedAppContext.Provider>
  );
}

export function useAuthenticatedApp() {
  const context = useContext(AuthenticatedAppContext);

  if (!context) {
    throw new Error("useAuthenticatedApp 必须在登录后应用布局内使用");
  }

  return context;
}
