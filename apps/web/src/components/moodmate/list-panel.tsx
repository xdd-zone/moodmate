import { Search } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";

type MoodmateListPanelProps = {
  actions?: ReactNode;
  children: ReactNode;
  searchInput?: Omit<InputHTMLAttributes<HTMLInputElement>, "aria-label"> & {
    "aria-label": string;
  };
  sectionLabel?: string;
  title: string;
};

export function MoodmateListPanel({
  actions,
  children,
  searchInput,
  sectionLabel,
  title,
}: MoodmateListPanelProps) {
  return (
    <>
      <header className="moodmate-list__header">
        <div className="moodmate-list__title-row">
          <h1 className="moodmate-list__title">{title}</h1>
          {actions ? (
            <div className="moodmate-list__actions">{actions}</div>
          ) : null}
        </div>
        {searchInput ? (
          <label className="moodmate-search">
            <Search aria-hidden="true" />
            <span className="sr-only">{searchInput["aria-label"]}</span>
            <input {...searchInput} type="search" />
          </label>
        ) : null}
      </header>
      {sectionLabel ? (
        <div className="moodmate-list__section">{sectionLabel}</div>
      ) : null}
      <div className="moodmate-scroll moodmate-list__content">{children}</div>
    </>
  );
}
