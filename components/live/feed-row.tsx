"use client";

import { motion, useReducedMotion } from "motion/react";

import type { FeedEntry } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

import { SPLIT_META, SplitBadge } from "./split-badge";

/** One athlete row. Flips in from its top edge; the newest row is emphasized. */
export function FeedRow({
  entry,
  newest,
}: {
  entry: FeedEntry;
  newest: boolean;
}) {
  const reduce = useReducedMotion();
  const meta = SPLIT_META[entry.split];
  const Glyph = meta.Glyph;

  const variants = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { rotateX: -90, opacity: 0 },
        animate: { rotateX: 0, opacity: 1 },
        exit: { rotateX: 80, opacity: 0 },
      };

  return (
    <motion.div
      layout
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={{ duration: 0.45, ease: [0.34, 1.4, 0.5, 1] }}
      className={cn(
        "flex h-[70px] origin-top items-center gap-3 overflow-hidden border-b border-border/60 px-6 last:border-b-0",
        meta.accent,
        newest && meta.tint,
      )}
    >
      <Glyph weight="bold" className={cn("size-6 shrink-0", meta.text)} aria-hidden />
      <span className={cn("font-bold tabular-nums", meta.text)}>{entry.bib}</span>
      <span
        className={cn(
          "truncate font-semibold text-neutral-950",
          newest ? "text-2xl" : "text-xl",
        )}
      >
        {entry.name}
      </span>
      <SplitBadge split={entry.split} className="ml-1" />
      <span className="ml-auto shrink-0 font-medium tabular-nums text-neutral-500">
        {entry.timeRaw}
      </span>
    </motion.div>
  );
}
