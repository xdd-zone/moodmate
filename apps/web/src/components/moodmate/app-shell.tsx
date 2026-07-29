import type { ReactNode } from "react";

import { classNames } from "./class-names";

export type MoodmateShellVariant = "default" | "has-info" | "no-list";

type MoodmateAppShellBaseProps = {
  children: ReactNode;
  className?: string;
  navigation: ReactNode;
};

type MoodmateAppShellProps = MoodmateAppShellBaseProps &
  (
    | {
        information?: never;
        list: ReactNode;
        variant?: "default";
      }
    | {
        information: ReactNode;
        list: ReactNode;
        variant: "has-info";
      }
    | {
        information?: never;
        list?: never;
        variant: "no-list";
      }
  );

export function MoodmateAppShell({
  children,
  className,
  information,
  list,
  navigation,
  variant = "default",
}: MoodmateAppShellProps) {
  return (
    <div
      className={classNames(
        "moodmate moodmate-app",
        `moodmate-app--${variant}`,
        className,
      )}
    >
      {navigation}
      {variant !== "no-list" ? (
        <aside className="moodmate-list">{list}</aside>
      ) : null}
      <main className="moodmate-main">{children}</main>
      {variant === "has-info" ? (
        <aside className="moodmate-info">{information}</aside>
      ) : null}
    </div>
  );
}
