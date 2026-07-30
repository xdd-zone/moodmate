"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import type { MoodmateConversation } from "@/src/components/moodmate/models";

const STORAGE_KEY = "web:conversation-preferences";

const ConversationPreferenceSchema = z.object({
  archived: z.boolean().optional(),
  muted: z.boolean().optional(),
  pinned: z.boolean().optional(),
  unread: z.boolean().optional(),
});

const ConversationPreferencesSchema = z.record(
  z.string(),
  ConversationPreferenceSchema,
);

export type ConversationPreference = z.infer<
  typeof ConversationPreferenceSchema
>;
export type ConversationPreferences = z.infer<
  typeof ConversationPreferencesSchema
>;

export function getConversationKey(
  conversation: Pick<MoodmateConversation, "id" | "kind">,
) {
  return `${conversation.kind}:${conversation.id}`;
}

function readPreferences(): ConversationPreferences {
  if (typeof window === "undefined") return {};

  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) return {};

  try {
    const result = ConversationPreferencesSchema.safeParse(
      JSON.parse(rawValue),
    );

    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

function writePreferences(preferences: ConversationPreferences) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // 隐私模式下无法写入，只保留当前页面内的状态
  }
}

/**
 * 会话列表的本地偏好：置顶、免打扰、未读标记和归档。
 * 后端目前没有对应接口，状态只写在浏览器 localStorage 里。
 */
export function useConversationPreferences() {
  const [preferences, setPreferences] = useState<ConversationPreferences>({});
  const preferencesRef = useRef<ConversationPreferences>({});

  useEffect(() => {
    const stored = readPreferences();

    preferencesRef.current = stored;
    setPreferences(stored);
  }, []);

  const applyPreferences = useCallback((next: ConversationPreferences) => {
    preferencesRef.current = next;
    setPreferences(next);
    writePreferences(next);
  }, []);

  const updatePreference = useCallback(
    (key: string, patch: ConversationPreference) => {
      applyPreferences({
        ...preferencesRef.current,
        [key]: { ...preferencesRef.current[key], ...patch },
      });
    },
    [applyPreferences],
  );

  const restoreArchived = useCallback(() => {
    const next: ConversationPreferences = {};

    for (const [key, preference] of Object.entries(preferencesRef.current)) {
      next[key] = { ...preference, archived: false };
    }

    applyPreferences(next);
  }, [applyPreferences]);

  return { preferences, restoreArchived, updatePreference };
}
