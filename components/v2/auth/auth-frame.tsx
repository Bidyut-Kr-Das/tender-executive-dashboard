"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff, Moon, Sun } from "lucide-react";
import { setDark, useIsDark } from "@/components/v2/providers";
import { IconButton } from "@/components/v2/ui/button";
import { Input } from "@/components/v2/ui/field";

/** The signed-out screen: the app's rail on the left, one form on the canvas. */
export function AuthFrame({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  const isDark = useIsDark();

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-88 shrink-0 flex-col justify-between border-r bg-rail p-8 lg:flex">
        <span className="text-md font-semibold tracking-[-0.01em]">
          Tender Dashboard
        </span>
        <p className="type-display max-w-[18ch] text-balance">
          Every tender, from first notice to supply history.
        </p>
        <span className="text-xs text-ink-3">Laserpower</span>
      </aside>

      <main className="relative flex min-w-0 flex-1 items-center justify-center p-6">
        <IconButton
          label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setDark(!isDark)}
          className="absolute right-4 top-4"
        >
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </IconButton>

        <div className="w-full max-w-80">
          <span className="mb-8 block text-md font-semibold tracking-[-0.01em] lg:hidden">
            Tender Dashboard
          </span>
          <h1 className="type-display">{title}</h1>
          <p className="mt-1 text-ink-2">{hint}</p>
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className="h-9 pr-9" />
      <IconButton
        size="sm"
        label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        onClick={() => setShown(!shown)}
        className="absolute right-1.5 top-1.5"
      >
        {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </IconButton>
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-bad-soft px-2.5 py-2 text-bad">
      {children}
    </p>
  );
}
