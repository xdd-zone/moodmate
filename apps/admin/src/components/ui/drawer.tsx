"use client";

import { Button } from "@repo/ui/button";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export interface DrawerProps {
  ariaDescribedby?: string;
  ariaLabelledby?: string;
  children: ReactNode;
  description?: ReactNode;
  maxWidth?: string;
  onClose: () => void;
  onOpen?: () => void;
  open: boolean;
  title?: ReactNode;
}

export function Drawer({
  open,
  onClose,
  onOpen,
  title,
  description,
  children,
  maxWidth = "max-w-[27.5rem]",
  ariaLabelledby,
  ariaDescribedby,
}: DrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      onOpen?.();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, onOpen]);

  return (
    <dialog
      aria-describedby={ariaDescribedby}
      aria-labelledby={ariaLabelledby}
      className="mood-detail-dialog fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 text-foreground"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <aside
        className={`mood-detail-drawer ml-auto flex h-dvh w-full ${maxWidth} flex-col border-l border-border bg-background shadow-soft`}
      >
        {title || description ? (
          <header className="flex items-start gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0 flex-1">
              {title ? (
                <h2 className="text-base font-semibold" id={ariaLabelledby}>
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="mt-0.5 text-xs text-muted" id={ariaDescribedby}>
                  {description}
                </p>
              ) : null}
            </div>
            <Button
              aria-label="关闭抽屉"
              className="ml-auto p-0"
              onClick={onClose}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="size-4" />
            </Button>
          </header>
        ) : null}
        {children}
      </aside>
    </dialog>
  );
}
