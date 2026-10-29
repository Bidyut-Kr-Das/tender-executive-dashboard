"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { ChatStatus, UIMessage } from "ai";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/v2/ui/button";
import { Skeleton } from "@/components/v2/ui/page";
import { ChatMessage } from "./chat-message";

/** The scrolling list of turns, with the waiting placeholder and the error row. */
export function ChatThread({
  messages,
  status,
  errorText,
  onRetry,
  empty,
}: {
  messages: UIMessage[];
  status: ChatStatus;
  errorText: string | null;
  onRetry: () => void;
  empty: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  // Follow new text only while the reader is already at the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  // Sending always jumps back to the newest turn.
  const last = messages.at(-1);
  useEffect(() => {
    if (last?.role === "user") pinnedRef.current = true;
  }, [last?.id, last?.role]);

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => {
        const el = e.currentTarget;
        pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
      }}
      className="thumb-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4"
    >
      {messages.length === 0 ? (
        empty
      ) : (
        <ol className="flex flex-col gap-4">
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} />
          ))}
          {status === "submitted" && last?.role === "user" && (
            <li aria-hidden className="flex flex-col gap-1.5 pt-1">
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </li>
          )}
          {errorText && (
            <li className="flex items-center gap-2 rounded-lg bg-bad-soft px-3 py-2 text-bad">
              <span className="min-w-0 flex-1">{errorText}</span>
              <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={onRetry}>
                Try again
              </Button>
            </li>
          )}
        </ol>
      )}
    </div>
  );
}
