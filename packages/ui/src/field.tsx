import type { ComponentProps } from "react";

import { Label } from "./label";
import { cn } from "./lib/utils";

function Field({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("grid gap-1.5", className)}
      data-slot="field"
      {...props}
    />
  );
}

function FieldLabel({ className, ...props }: ComponentProps<"label">) {
  return <Label className={className} data-slot="field-label" {...props} />;
}

function FieldControl({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("grid gap-1", className)}
      data-slot="field-control"
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-xs leading-4 text-muted", className)}
      data-slot="field-description"
      {...props}
    />
  );
}

function FieldError({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-xs leading-4 text-danger", className)}
      data-slot="field-error"
      role="alert"
      {...props}
    />
  );
}

export { Field, FieldControl, FieldDescription, FieldError, FieldLabel };
