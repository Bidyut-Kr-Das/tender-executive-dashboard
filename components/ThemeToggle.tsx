"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Toaster } from "sonner";

// Inline script for <head>: applies the saved theme before first paint.
export const themeInitScript = `try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function useIsDark() {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

function setDark(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {}
}

export function ThemeToggle() {
  const isDark = useIsDark();
  return (
    <button
      type="button"
      onClick={() => setDark(!isDark)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export function ThemedToaster() {
  const isDark = useIsDark();
  return <Toaster richColors theme={isDark ? "dark" : "light"} />;
}
