"use client";

import { useRef, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from "motion/react";
import { X } from "lucide-react";
import { IconButton } from "./button";

/** Where a flick would come to rest: scroll-style exponential decay. */
function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

// Critically damped: a panel that just arrived should not overshoot.
const SETTLE = { type: "spring", bounce: 0, duration: 0.4 } as const;

/**
 * Right-edge panel. Enters and leaves along the same edge, can be grabbed by
 * its header mid-flight, and dismisses on where the gesture is heading rather
 * than where it was released.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  width = "40vw",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  width?: string;
}) {
  const reduceMotion = useReducedMotion();
  const controls = useDragControls();
  const panelRef = useRef<HTMLDivElement>(null);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const panelWidth = panelRef.current?.offsetWidth ?? 480;
    const landing = info.offset.x + project(info.velocity.x);
    if (landing > panelWidth / 2) onOpenChange(false);
  };

  const hidden = reduceMotion
    ? { opacity: 0, x: 0 }
    : { opacity: 0.999, x: "100%" };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal keepMounted>
            <Dialog.Backdrop
              render={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              }
              className="fixed inset-0 z-(--z-modal) bg-(--scrim)"
            />
            <Dialog.Popup
              render={
                <motion.div
                  ref={panelRef}
                  initial={hidden}
                  animate={{ opacity: 1, x: 0 }}
                  exit={hidden}
                  transition={reduceMotion ? { duration: 0.15 } : SETTLE}
                  drag={reduceMotion ? false : "x"}
                  dragControls={controls}
                  dragListener={false}
                  dragConstraints={{ left: 0, right: 0 }}
                  // Free toward the dismissing edge, rubber-banded past the open one.
                  dragElastic={{ left: 0.06, right: 1 }}
                  onDragEnd={onDragEnd}
                />
              }
              style={{ width: `clamp(22rem, ${width}, calc(100vw - 2rem))` }}
              className="fixed inset-y-0 right-0 z-(--z-modal) flex flex-col bg-raised shadow-(--shadow-sheet) outline-none will-change-transform"
            >
              <header
                onPointerDown={(e) => controls.start(e)}
                className="flex shrink-0 cursor-grab touch-none select-none items-center gap-3 border-b px-5 py-3 active:cursor-grabbing"
              >
                <Dialog.Title className="min-w-0 flex-1 truncate type-title">
                  {title}
                </Dialog.Title>
                <Dialog.Close
                  onPointerDown={(e) => e.stopPropagation()}
                  render={
                    <IconButton label="Close" size="sm">
                      <X className="size-4" />
                    </IconButton>
                  }
                />
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {children}
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
