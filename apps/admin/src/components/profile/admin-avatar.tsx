"use client";

import type { AdminProfileAvatar } from "@repo/contracts";
import Image from "next/image";
import { useState } from "react";

export function AdminAvatar({
  alt,
  avatar,
  className = "",
  displayName,
}: {
  alt: string;
  avatar: AdminProfileAvatar | null;
  className?: string;
  displayName: string;
}) {
  const initial = Array.from(displayName.trim())[0]?.toUpperCase() ?? "管";

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-subtle text-primary-strong${className ? ` ${className}` : ""}`}
    >
      {avatar ? (
        <AvatarImage
          alt={alt}
          avatar={avatar}
          initial={initial}
          key={avatar.key}
        />
      ) : (
        <AvatarFallback alt={alt} initial={initial} />
      )}
    </span>
  );
}

function AvatarImage({
  alt,
  avatar,
  initial,
}: {
  alt: string;
  avatar: AdminProfileAvatar;
  initial: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) return <AvatarFallback alt={alt} initial={initial} />;

  return (
    <Image
      alt={alt}
      className="object-cover"
      fill
      onError={() => setFailed(true)}
      sizes="96px"
      src={`/api/profile/avatar/image?key=${encodeURIComponent(avatar.key)}`}
      unoptimized
    />
  );
}

function AvatarFallback({ alt, initial }: { alt: string; initial: string }) {
  return (
    <span
      aria-hidden={alt ? undefined : true}
      aria-label={alt || undefined}
      role={alt ? "img" : undefined}
    >
      {initial}
    </span>
  );
}
