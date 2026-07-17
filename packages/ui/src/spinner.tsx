import type { ComponentProps } from "react";

import { cn } from "./lib/utils";

function Spinner({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-primary",
        className,
      )}
      data-slot="spinner"
      {...props}
    />
  );
}

export { Spinner };
