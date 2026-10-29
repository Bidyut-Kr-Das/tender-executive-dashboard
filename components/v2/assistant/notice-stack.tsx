"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ToastT } from "sonner";
import { NoticeBubble } from "./notice-bubble";
import { popIn } from "./pop";

const MAX_SHOWN = 3;

/** Pip's notifications, newest nearest Pip. `toasts` arrives newest first. */
export function NoticeStack({ toasts, tail }: { toasts: ToastT[]; tail: "bottom" | "left" }) {
  const reduceMotion = useReducedMotion();
  const shown = toasts.slice(0, MAX_SHOWN).reverse();
  return (
    <div className={`flex flex-col gap-2 ${tail === "bottom" ? "items-center" : "items-start"}`}>
      <AnimatePresence initial={false}>
        {shown.map((t) => (
          <motion.div
            key={t.id}
            layout={reduceMotion ? false : "position"}
            {...popIn(reduceMotion)}
            style={{ transformOrigin: tail === "bottom" ? "bottom center" : "left center" }}
          >
            <NoticeBubble notice={t} tail={tail} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
