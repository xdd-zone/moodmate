import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "./lib/utils";

const alertVariants = cva(
  "grid gap-1 rounded-md border px-4 py-3 text-sm leading-6",
  {
    variants: {
      variant: {
        info: "border-info bg-info-subtle text-info",
        success: "border-success bg-success-subtle text-success",
        warning: "border-warning bg-warning-subtle text-warning",
        danger: "border-danger bg-danger-subtle text-danger",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

type AlertProps = ComponentProps<"div"> & VariantProps<typeof alertVariants>;

function Alert({ className, variant, ...props }: AlertProps) {
  const role =
    variant === "danger" || variant === "warning" ? "alert" : "status";

  return (
    <div
      className={cn(alertVariants({ variant }), className)}
      data-slot="alert"
      role={role}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("font-semibold", className)}
      data-slot="alert-title"
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("leading-6 opacity-90", className)}
      data-slot="alert-description"
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle, alertVariants };
