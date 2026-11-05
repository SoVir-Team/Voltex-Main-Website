"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { clsx } from "clsx";
import { X } from "lucide-react";

/**
 * Native <dialog> as a modal or a side drawer: the browser provides the focus trap, Escape to close and the
 * inert background. Opening/closing is driven by the `open` prop.
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  variant = "modal",
  className,
  children,
  closeLabel = "Close",
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  variant?: "modal" | "drawer";
  className?: string;
  children: ReactNode;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    d.addEventListener("cancel", onCancel);
    return () => d.removeEventListener("cancel", onCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      className={clsx(
        "m-0 max-h-none max-w-none bg-ground p-0 text-ink backdrop:bg-ink-deep/45 open:flex open:flex-col",
        variant === "drawer"
          ? "fixed inset-y-0 right-0 left-auto h-dvh w-full sm:w-[30rem] open:animate-[drawer-in_.35s_var(--ease-out-expo)]"
          : "fixed inset-0 m-auto h-fit max-h-[92dvh] w-[min(64rem,calc(100vw-2rem))] overflow-y-auto open:animate-[pop-in_.3s_var(--ease-out-expo)]",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center text-ink transition-colors hover:bg-surface"
      >
        <X aria-hidden className="h-5 w-5" />
      </button>
      {children}
    </dialog>
  );
}
