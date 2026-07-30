import { UsersRound } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import type { MoodmateProfile } from "./models";
import { classNames } from "./class-names";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

type AvatarStyle = CSSProperties & {
  "--mm-avatar-end": string;
  "--mm-avatar-start": string;
};

type MoodmateAvatarProps = {
  className?: string;
  image?: ReactNode;
  isGroup?: boolean;
  onSurface?: boolean;
  profile: MoodmateProfile;
  showStatus?: boolean;
  size?: AvatarSize;
};

const statusLabels = {
  busy: "忙碌",
  offline: "离线",
  online: "在线",
} as const;

export function MoodmateAvatar({
  className,
  image,
  isGroup = false,
  onSurface = false,
  profile,
  showStatus = false,
  size = "md",
}: MoodmateAvatarProps) {
  const style: AvatarStyle = {
    "--mm-avatar-end": profile.palette.end,
    "--mm-avatar-start": profile.palette.start,
  };
  const initial = Array.from(profile.name.trim())[0] ?? "M";
  const status = profile.status ?? "offline";

  return (
    <span
      className={classNames(
        "moodmate-avatar",
        `moodmate-avatar--${size}`,
        isGroup && "moodmate-avatar--group",
        onSurface && "moodmate-avatar--on-surface",
        className,
      )}
      style={style}
    >
      <span
        aria-label={`${profile.name}的头像`}
        className="moodmate-avatar__content"
        role="img"
      >
        {image ?? initial}
      </span>
      {isGroup ? (
        <span className="moodmate-avatar__group-badge" aria-hidden="true">
          <UsersRound />
        </span>
      ) : null}
      {showStatus ? (
        <span
          aria-label={statusLabels[status]}
          className={classNames(
            "moodmate-avatar__status",
            `moodmate-avatar__status--${status}`,
          )}
          role="status"
          title={statusLabels[status]}
        />
      ) : null}
    </span>
  );
}
