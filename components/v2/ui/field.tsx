import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
} from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const FIELD =
  "edge w-full rounded-lg bg-surface px-2.5 text-md text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50";

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
      <span className="type-label text-ink-3">{label}</span>
      {children}
    </label>
  );
}

/** The box alone, for a row that is already a checkbox or a menu item. */
export function CheckMark({
  checked,
  className,
}: {
  checked: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-3.5 shrink-0 items-center justify-center rounded-[0.25rem]",
        checked ? "bg-accent text-on-accent" : "edge",
        className,
      )}
    >
      {checked && <Check className="size-3" strokeWidth={3} />}
    </span>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <CheckMark
        checked={checked}
        className="peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-accent"
      />
      {children}
    </label>
  );
}

/** Pick one of a few options that fit on a line. */
export function Choice<T extends string | boolean | null>({
  label,
  options,
  value,
  onChange,
  allowClear = false,
  className,
}: {
  /** Accessible name of the group. */
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  /** Receives null when `allowClear` is set and the selected option is pressed again. */
  onChange: (value: T | null) => void;
  allowClear?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <Button
            key={String(o.value)}
            size="sm"
            variant={on ? "primary" : "secondary"}
            aria-pressed={on}
            onClick={() => onChange(on && allowClear ? null : o.value)}
          >
            {o.label}
          </Button>
        );
      })}
    </div>
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
        "type-label inline-flex w-fit items-center rounded-[0.3125rem] px-1.5 py-px leading-[1.35] tracking-[0.01em]",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const Dash = () => <span className="text-ink-3">–</span>;
