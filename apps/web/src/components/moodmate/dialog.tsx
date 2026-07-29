"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

type MoodmateDialogProps = {
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
};

export function MoodmateDialog({
  children,
  description,
  footer,
  onClose,
  open,
  title,
}: MoodmateDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      className="moodmate moodmate-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      ref={dialogRef}
    >
      <div className="moodmate-dialog__panel">
        <header className="moodmate-dialog__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button
            aria-label="关闭"
            className="moodmate-icon-button"
            onClick={onClose}
            title="关闭"
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="moodmate-dialog__body moodmate-scroll">{children}</div>
        {footer ? (
          <footer className="moodmate-dialog__footer">{footer}</footer>
        ) : null}
      </div>
    </dialog>
  );
}
