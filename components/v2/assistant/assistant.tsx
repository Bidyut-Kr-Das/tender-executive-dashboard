"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Mascot } from "wobnimo/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, RotateCcw, Square, SquarePen, X } from "lucide-react";
import { Button, IconButton } from "@/components/v2/ui/button";
import { Tip } from "@/components/v2/ui/overlay";
import { Skeleton } from "@/components/v2/ui/page";
import { describeError } from "@/components/v2/ui/errors";
import { useIsDeveloper } from "@/components/v2/providers";

type MascotState = "idle" | "listening" | "thinking" | "speaking" | "error" | "celebrating" | "sleeping";

const SLEEP_AFTER_MS = 2 * 60 * 1000;
const CELEBRATE_MS = 1500;
const STARTERS = ["What can you help with?", "Explain EMD and PBG"];
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
// Horizontal centre of the content area, beside the sidebar in either width.
const CENTER =
  "left-[calc(50%+var(--sidebar-w)/2)] in-data-[sidebar=collapsed]:left-[calc(50%+var(--sidebar-rail-w)/2)] -translate-x-1/2";

const transport = new DefaultChatTransport({ api: "/api/assistant" });

export function Assistant() {
  const { data: session, status: sessionStatus } = useSession();
  const isDeveloper = useIsDeveloper();
  if (sessionStatus !== "authenticated") return null;
  return <AssistantDock firstName={session.user?.name?.split(" ")[0] ?? null} isDeveloper={isDeveloper} />;
}

function AssistantDock({ firstName, isDeveloper }: { firstName: string | null; isDeveloper: boolean }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const inputId = useId();
  const { messages, sendMessage, status, error, stop, regenerate, setMessages } = useChat({ transport });

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [asleep, setAsleep] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const orbRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const prevStatus = useRef(status);

  const busy = status === "submitted" || status === "streaming";

  // A finished turn earns a short celebration before settling back to idle.
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;
    if (was === "streaming" && status === "ready") {
      setCelebrating(true);
      const t = setTimeout(() => setCelebrating(false), CELEBRATE_MS);
      return () => clearTimeout(t);
    }
  }, [status]);

  // Doze off after a while with nothing happening; any activity wakes it.
  useEffect(() => {
    setAsleep(false);
    if (open || busy) return;
    const t = setTimeout(() => setAsleep(true), SLEEP_AFTER_MS);
    return () => clearTimeout(t);
  }, [open, busy, messages.length]);

  useEffect(() => {
    if (!error) return setErrorText(null);
    describeError(error).then(setErrorText);
  }, [error]);

  // Ctrl/Cmd+J toggles from anywhere in the app.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus follows the card: into the composer on open, back to Pip on close.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (wasOpen.current) orbRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // Follow new text only while the reader is already at the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const mascotState: MascotState = error
    ? "error"
    : status === "submitted"
      ? "thinking"
      : status === "streaming"
        ? "speaking"
        : celebrating
          ? "celebrating"
          : open && input.trim()
            ? "listening"
            : asleep
              ? "sleeping"
              : "idle";

  const statusLine =
    status === "submitted" ? "Thinking" : status === "streaming" ? "Writing" : error ? "Something went wrong" : "Assistant";

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    pinnedRef.current = true;
    sendMessage({ text: trimmed }, { body: { path: pathname } });
    setInput("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function onComposerKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  }

  const lastIsUser = messages.at(-1)?.role === "user";

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.section
            key="card"
            role="dialog"
            aria-label="Assistant"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.14, ease: EASE_OUT } }}
            style={{ transformOrigin: "bottom center", boxShadow: "var(--shadow-pop)" }}
            className={`fixed bottom-21 z-(--z-assistant) flex ${isDeveloper ? "h-[min(37.5rem,calc(100dvh-7rem))]" : ""} w-100 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-raised ${CENTER}`}
          >
            <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2 pl-4">
              <div className="min-w-0 flex-1">
                <h2 className="type-title leading-tight">Pip</h2>
                <p aria-live="polite" className={error ? "text-xs text-bad" : "text-xs text-ink-3"}>
                  {statusLine}
                </p>
              </div>
              {isDeveloper && (
                <IconButton
                  label="New chat"
                  disabled={busy || messages.length === 0}
                  onClick={() => {
                    setMessages([]);
                    inputRef.current?.focus();
                  }}
                >
                  <SquarePen className="size-4" />
                </IconButton>
              )}
              <IconButton label="Close (Esc)" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </IconButton>
            </header>

            {!isDeveloper ? (
              <div className="flex flex-col gap-0.5 px-4 py-6 text-center">
                <p className="type-title">This feature is work in progress</p>
                <p className="text-ink-2">Pip will be able to help you here soon.</p>
              </div>
            ) : (
            <>
            <div
              ref={scrollRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
              }}
              className="thumb-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4"
            >
              {messages.length === 0 ? (
                <div className="flex h-full flex-col justify-end gap-3 pb-1">
                  <div>
                    <p className="type-title">{firstName ? `Hi ${firstName}` : "Hi there"}</p>
                    <p className="mt-0.5 text-ink-2">Ask about tenders, terms or how this dashboard works.</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STARTERS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="press hairline not-disabled:hover:bg-hover rounded-full bg-surface px-3 py-1.5 text-xs text-ink-2"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ol className="flex flex-col gap-4">
                  {messages.map((m) => {
                    const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
                    return m.role === "user" ? (
                      <li key={m.id} className="max-w-[85%] self-end whitespace-pre-wrap rounded-xl bg-sunken px-3 py-2">
                        {text}
                      </li>
                    ) : (
                      <li key={m.id} className="md min-w-0 *:last:mb-0">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                      </li>
                    );
                  })}
                  {status === "submitted" && lastIsUser && (
                    <li aria-hidden className="flex flex-col gap-1.5 pt-1">
                      <Skeleton className="h-3 w-4/5" />
                      <Skeleton className="h-3 w-3/5" />
                      <Skeleton className="h-3 w-2/5" />
                    </li>
                  )}
                  {errorText && (
                    <li className="flex items-center gap-2 rounded-lg bg-bad-soft px-3 py-2 text-bad">
                      <span className="min-w-0 flex-1">{errorText}</span>
                      <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => regenerate()}>
                        Try again
                      </Button>
                    </li>
                  )}
                </ol>
              )}
            </div>

            <form onSubmit={onSubmit} className="shrink-0 p-3 pt-0">
              <div className="edge flex items-end gap-2 rounded-xl bg-surface p-1.5 pl-3 focus-within:outline-2 focus-within:outline-accent">
                <label htmlFor={inputId} className="sr-only">
                  Message Pip
                </label>
                <textarea
                  ref={inputRef}
                  id={inputId}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onComposerKey}
                  placeholder="Ask Pip"
                  className="field-sizing-content max-h-36 min-h-7 flex-1 resize-none bg-transparent py-1 leading-snug outline-none placeholder:text-ink-3 focus-visible:outline-none"
                />
                {busy ? (
                  <Button size="sm" className="w-7 px-0" aria-label="Stop" title="Stop" icon={<Square className="size-3 fill-current" />} onClick={() => stop()} />
                ) : (
                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    className="w-7 px-0"
                    aria-label="Send"
                    title="Send (Enter)"
                    disabled={!input.trim()}
                    icon={<ArrowUp className="size-3.5" />}
                  />
                )}
              </div>
            </form>
            </>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      <Tip label={open ? "Close Pip (Ctrl+J)" : "Ask Pip (Ctrl+J)"} side="top">
        {/* Feet tucked below the viewport edge, so Pip peeks up from the bottom. */}
        <button
          ref={orbRef}
          type="button"
          aria-label={open ? "Close assistant" : "Open assistant"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`press fixed bottom-5 z-(--z-assistant) size-24 rounded-full ${CENTER}`}
        >
          <Mascot
            character="pip"
            state={mascotState}
            onReady={() => setReady(true)}
            className="size-full transition-opacity duration-(--dur-dialog)"
            style={{ opacity: ready ? 1 : 0 }}
          />
        </button>
      </Tip>
    </>
  );
}
