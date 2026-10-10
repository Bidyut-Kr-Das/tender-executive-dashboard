import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  primary: "bg-accent text-on-accent hover:brightness-110",
  secondary:
    "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover-bg",
  ghost: "text-ink-2 hover-bg",
  danger: "bg-bad text-white hover:brightness-110",
} as const;

const SIZES = {
  sm: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  md: "h-8 px-3 text-[0.8125rem] gap-1.5 rounded-lg",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
  icon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "press inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="spin size-3.5" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon-only control, so the accessible name is required. */
  label: string;
  size?: "sm" | "md";
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  label,
  size = "md",
  className,
  children,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "press hover-bg inline-flex shrink-0 items-center justify-center rounded-md text-ink-2 disabled:opacity-50",
        size === "sm" ? "size-6" : "size-8",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
