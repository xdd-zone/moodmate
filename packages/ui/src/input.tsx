import type { ComponentProps } from "react";

import { cn } from "./lib/utils";

function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60",
        className,
      )}
      data-slot="input"
      {...props}
    />
  );
}

export { Input };
