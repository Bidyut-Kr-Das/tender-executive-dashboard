"use client";

import { useState, type ButtonHTMLAttributes, type Ref } from "react";
import { Mascot } from "wobnimo/react";
import type { PipMood } from "./use-pip-mood";

/** Pip itself: the mascot inside a button. */
export function PipOrb({
  mood,
  ref,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { mood: PipMood; ref?: Ref<HTMLButtonElement> }) {
  const [ready, setReady] = useState(false);
  return (
    <button ref={ref} type="button" className="press relative block size-28 rounded-full" {...rest}>
      {/* The canvas keeps a wide margin for hops and effects, so it spills past
          the button; the button stays a tight ring around Pip's body. Inline
          sizing because Mascot's own inline 160px would beat a class. */}
      <Mascot
        character="pip"
        state={mood}
        onReady={() => setReady(true)}
        className="pointer-events-none transition-opacity duration-(--dur-dialog)"
        style={{
          position: "absolute",
          left: "-25%",
          top: "-25%",
          width: "150%",
          height: "150%",
          opacity: ready ? 1 : 0,
        }}
      />
    </button>
  );
}
