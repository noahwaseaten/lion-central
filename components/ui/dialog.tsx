"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;

function DialogBackdrop({ className, hidden }: { className?: string; hidden?: boolean }) {
  return (
    <DialogPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-40",
        hidden
          ? "pointer-events-none bg-transparent"
          : "bg-black/60 backdrop-blur-sm",
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
  backdropHidden,
  positionStyle,
}: {
  children: React.ReactNode;
  className?: string;
  backdropHidden?: boolean;
  positionStyle?: React.CSSProperties;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogBackdrop hidden={backdropHidden} />
      <DialogPrimitive.Popup
        className={cn(
          "fixed z-50 rounded-xl border border-border bg-card shadow-2xl shadow-black/60 outline-none",
          "transition-[left,top,width,height,transform,opacity] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          !positionStyle && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          "data-[starting-style]:opacity-0",
          "data-[ending-style]:opacity-0",
          "motion-reduce:transition-none",
          className,
        )}
        style={positionStyle}
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
