"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

/**
 * Styled toggle switch. Renders label on the left, pill track on the right.
 * Uses Base UI Switch — consistent with the rest of the UI primitive layer.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 text-sm",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span>{label}</span>
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-input bg-input outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          "data-[checked]:border-signal data-[checked]:bg-signal",
          "disabled:cursor-not-allowed",
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "pointer-events-none block h-3.5 w-3.5 rounded-full bg-background shadow-sm transition-transform",
            "translate-x-0.5 data-[checked]:translate-x-[18px]",
          )}
        />
      </SwitchPrimitive.Root>
    </label>
  );
}
