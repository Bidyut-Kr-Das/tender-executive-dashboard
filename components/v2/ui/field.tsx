import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

const FIELD =
  "w-full rounded-lg bg-surface px-2.5 text-[0.8125rem] text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50";

export function Input({
  className,
  ref,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(FIELD, "h-8", className)} {...rest} />;
}

export function Textarea({
  className,
  ref,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: Ref<HTMLTextAreaElement>;
}) {
  return (
    <textarea
      ref={ref}
      className={cn(FIELD, "resize-y py-2 leading-snug", className)}
      {...rest}
    />
  );
}

/** Label above a control; proximity carries the relationship. */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[0.6875rem] font-medium tracking-[0.02em] text-ink-3">
        {label}
      </span>
      {children}
    </label>
  );
}

const TONES = {
  neutral: "bg-hover text-ink-2",
  accent: "bg-accent-soft text-accent-ink",
  good: "bg-good-soft text-good",
  bad: "bg-bad-soft text-bad",
  warn: "bg-warn-soft text-warn",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({
  tone = "neutral",
  className,
  children,
  title,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex w-fit items-center rounded-[0.3125rem] px-1.5 py-px text-[0.6875rem] font-medium leading-[1.35] tracking-[0.01em]",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const Dash = () => <span className="text-ink-3">–</span>;
