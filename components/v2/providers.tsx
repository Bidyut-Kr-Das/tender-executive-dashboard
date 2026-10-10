"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import StoreProvider from "@/lib/store-provider";
import { TooltipProvider } from "@/components/v2/ui/overlay";

// Same storage keys as v1, so the theme follows the user across both shells.
export const bootScript = `try{var d=document.documentElement;if(localStorage.getItem("theme")==="dark")d.classList.add("dark");if(localStorage.getItem("v2-sidebar")==="collapsed")d.dataset.sidebar="collapsed"}catch(e){}`;

function subscribeRoot(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-sidebar"],
  });
  return () => observer.disconnect();
}

export function useIsDark() {
  return useSyncExternalStore(
    subscribeRoot,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

export function setDark(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {}
}

export function useSidebarCollapsed() {
  return useSyncExternalStore(
    subscribeRoot,
    () => document.documentElement.dataset.sidebar === "collapsed",
    () => false,
  );
}

export function setSidebarCollapsed(collapsed: boolean) {
  const root = document.documentElement;
  if (collapsed) root.dataset.sidebar = "collapsed";
  else delete root.dataset.sidebar;
  try {
    localStorage.setItem("v2-sidebar", collapsed ? "collapsed" : "open");
  } catch {}
}

function ThemedToaster() {
  const isDark = useIsDark();
  return <Toaster richColors theme={isDark ? "dark" : "light"} />;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <StoreProvider>
        <TooltipProvider delay={500} timeout={400}>
          {children}
        </TooltipProvider>
        <ThemedToaster />
      </StoreProvider>
    </SessionProvider>
  );
}
