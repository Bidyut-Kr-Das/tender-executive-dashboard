/** Motion and surface values shared by everything that pops out of Pip. */

export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

// Pip speaks in lavender so its bubbles and chat stand apart from the page.
export const PIP_SHADOW = "0 0 0 1px var(--lavender-line), var(--shadow-pop)";

/** Grows out of Pip's head; reduced motion fades only. */
export function popIn(reduceMotion: boolean | null) {
  return {
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } },
    exit: reduceMotion
      ? { opacity: 0 }
      : { opacity: 0, scale: 0.96, y: 4, transition: { duration: 0.14, ease: EASE_OUT } },
    style: { transformOrigin: "bottom center" },
  };
}
