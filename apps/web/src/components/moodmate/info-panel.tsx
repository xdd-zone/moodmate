import type { ReactNode } from "react";

import { MoodmateAvatar } from "./avatar";
import type { MoodmateProfile } from "./models";

type MoodmateInfoPanelProps = {
  children: ReactNode;
  isGroup?: boolean;
  profile: MoodmateProfile;
};

type MoodmateInfoSectionProps = {
  children: ReactNode;
  title: string;
};

export function MoodmateInfoPanel({
  children,
  isGroup = false,
  profile,
}: MoodmateInfoPanelProps) {
  return (
    <>
      <header className="moodmate-info__header">
        <MoodmateAvatar
          isGroup={isGroup}
          onSurface
          profile={profile}
          showStatus={!isGroup}
          size="xl"
        />
        <h2 className="moodmate-info__name">{profile.name}</h2>
        <p className="moodmate-info__headline">{profile.headline}</p>
      </header>
      <div className="moodmate-scroll moodmate-info__content">{children}</div>
    </>
  );
}

export function MoodmateInfoSection({
  children,
  title,
}: MoodmateInfoSectionProps) {
  return (
    <section className="moodmate-info__section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
