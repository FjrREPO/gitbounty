"use client";

import { motion } from "framer-motion";
import { ArrowLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Centered, backdrop-blurred dialog. Rendered through a portal on `document.body` so it escapes any
 * ancestor containing block — the sticky header uses `backdrop-blur`, which (like `filter`/`transform`)
 * makes `position: fixed` resolve against the header instead of the viewport and clips the dialog.
 */
export function Modal({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={() => {}}
        role="button"
        tabIndex={-1}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      <motion.div
        className="relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-background shadow-2xl"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-foreground/5 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex cursor-pointer items-center gap-1.5 text-sm text-foreground/50 transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            Back
          </button>
          {title ? <div className="text-sm font-medium text-foreground/70">{title}</div> : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
