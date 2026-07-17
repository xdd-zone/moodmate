import type { ComponentProps } from "react";

import { cn } from "./lib/utils";

function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("text-sm font-medium leading-5 text-foreground", className)}
      data-slot="label"
      {...props}
    />
  );
}

export { Label };
