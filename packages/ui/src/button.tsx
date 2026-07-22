import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "./lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-control hover:bg-primary-hover active:bg-primary-active",
        secondary:
          "border border-border bg-surface text-foreground hover:border-border-strong hover:bg-surface-muted active:bg-surface-muted",
        outline:
          "border border-border bg-transparent text-foreground hover:border-border-strong hover:bg-surface-muted active:bg-surface-muted",
        ghost:
          "text-muted hover:bg-surface-muted hover:text-foreground active:bg-surface-muted",
        danger:
          "bg-danger text-danger-foreground shadow-control hover:bg-danger-hover active:bg-danger-hover",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 min-h-8 rounded-sm px-3 text-xs",
        lg: "h-10 min-h-10 px-5",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      data-slot="button"
      {...props}
    />
  );
}

export { Button, buttonVariants };
