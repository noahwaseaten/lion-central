"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;

function DialogBackdrop({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm",
        "transition-opacity data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
        "motion-reduce:transition-none",
        className,
      )}
    />
  );
}

function DialogPopup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogBackdrop />
      <DialogPrimitive.Popup
        className={cn(
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-2xl shadow-black/60 outline-none",
          "transition-[transform,opacity]",
          "data-[starting-style]:-translate-x-1/2 data-[starting-style]:-translate-y-[48%] data-[starting-style]:opacity-0",
          "data-[ending-style]:-translate-x-1/2 data-[ending-style]:-translate-y-[48%] data-[ending-style]:opacity-0",
          "motion-reduce:transition-none",
          className,
        )}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Title
      className={cn("text-sm font-semibold text-foreground", className)}
    >
      {children}
    </DialogPrimitive.Title>
  );
}

function DialogClose({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Close
      aria-label="Close"
      className={cn(
        "grid size-7 place-items-center rounded-md text-muted-foreground outline-none",
        "hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        "[&_svg]:size-4",
        className,
      )}
    >
      <X />
    </DialogPrimitive.Close>
  );
}

export { Dialog, DialogTrigger, DialogPopup, DialogTitle, DialogClose };
