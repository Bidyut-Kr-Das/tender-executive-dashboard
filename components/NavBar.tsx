"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { ChevronDown, KeyRound, LogIn, LogOut, User, UserPlus } from "lucide-react";
import { UnderChangesBanner } from "@/components/UnderChangesBanner";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";

const links: Array<{ href: string; label: string; isExternal?: boolean }> = [
  { href: "/tenders", label: "Tenders" },
  { href: "/", label: "Pre Participation" },
  { href: "/post-participation", label: "Post Participation" },
  {
    href: "/not-participated",
    label: "Not Participated",
  },
  { href: "/supply-history", label: "Supply History Dashboard" },
  { href: "/railways", label: "Railways" },
  { href: "/items", label: "Master Item List" },
  { href: "/performance-certificates", label: "Performance Certificates" },
  { href: "/emd", label: "EMD Merged" },
  // { href: "/emd-details-cash", label: "EMD Cash" },
  // { href: "/emd-details-bg", label: "EMD BG" },
  { href: "/credentials", label: "Links and Password" },
  { href: "/activity", label: "Activity" },
  { href: "/sop", label: "SOP" },
  // { href: "/merge-conflict", label: "Merge Conflict" },
];

const adminLinks = [
  { href: "/admin/mappings", label: "Column Mappings" },
  { href: "/admin/indices", label: "Column Index" },
  { href: "/admin/merging", label: "Column Merging" },
  { href: "/admin/sop", label: "SOP Responsibilities" },
];

function UserAvatar({
  name,
  email,
}: {
  name?: string | null;
  email?: string | null;
}) {
  const initials = (name || email || "U")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground dark:bg-primary dark:text-primary-foreground">
      {initials}
    </div>
  );
}

export function NavBar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const isAdminActive = adminLinks.some((l) => pathname === l.href);
  const [showChangePassword, setShowChangePassword] = useState(false);
  // console.log(session)

  return (
    <>
      <UnderChangesBanner />
      <nav className="fixed top-0 left-0 right-0 z-50 h-10.5 bg-card border-b border-border shadow-md dark:shadow-none">
        <NavigationMenu className="max-w-full w-full h-full gap-2 flex">
          <NavigationMenuList className="h-full px-2 gap-2 w-full justify-start">
            {links.map(({ href, label, isExternal }) => {
              const isActive = pathname === href;
              return (
                <NavigationMenuItem key={href}>
                  <NavigationMenuLink
                    render={
                      isExternal ? (
                        <a href={href} target="_self" />
                      ) : (
                        <Link href={href} />
                      )
                    }
                    className={cn(
                      "px-3 py-1.5 rounded text-sm font-semibold transition-colors hover:bg-brand hover:text-brand-foreground",
                      isActive
                        ? "bg-brand text-brand-foreground data-active:bg-brand data-active:text-brand-foreground dark:bg-primary dark:text-primary-foreground dark:data-active:bg-primary dark:data-active:text-primary-foreground"
                        : "text-foreground/80 data-active:bg-transparent data-active:text-foreground/80 dark:hover:bg-accent dark:hover:text-foreground",
                    )}
                  >
                    {label}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              );
            })}
            {isAuthenticated && (session?.user?.role === "admin" || session?.user?.role === "developer") && (
              <NavigationMenuItem className="ml-auto relative">
                <div className="group inline-flex">
                  <button
                    className={cn(
                      "px-3 py-1.5 rounded text-sm font-semibold transition-colors inline-flex items-center gap-1 hover:bg-brand hover:text-brand-foreground",
                      isAdminActive
                        ? "bg-brand text-brand-foreground dark:bg-primary dark:text-primary-foreground"
                        : "text-foreground/80 dark:hover:bg-accent dark:hover:text-foreground",
                    )}
                  >
                    Admin <ChevronDown size={14} />
                  </button>
                  <div className="absolute right-0 top-full mt-0.5 w-48 bg-popover border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                    {adminLinks.map(({ href, label }) => {
                      const isActive = pathname === href;
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={cn(
                            "block px-4 py-2 text-sm transition-colors hover:bg-accent",
                            isActive
                              ? "bg-muted font-semibold text-brand-ink"
                              : "text-foreground/80",
                          )}
                        >
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </NavigationMenuItem>
            )}
          </NavigationMenuList>

          <div className="flex items-center gap-2 px-3 ml-auto">
            <ThemeToggle />
            {status === "loading" ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
            ) : isAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {session?.user?.name || session?.user?.email}
                </span>
                <div className="group relative">
                  <button className="flex items-center gap-1 rounded-lg p-1 transition-colors hover:bg-accent">
                    <UserAvatar
                      name={session?.user?.name}
                      email={session?.user?.email}
                    />
                  </button>
                  <div className="absolute right-0 top-full mt-1 hidden w-48 rounded-lg border border-border bg-popover py-1 shadow-lg group-hover:block">
                    <div className="border-b border-border px-3 py-2">
                      <p className="truncate text-xs font-medium text-foreground">
                        {session?.user?.name || "User"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {session?.user?.email}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowChangePassword(true)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground/80 hover:bg-accent"
                    >
                      <KeyRound size={14} />
                      Change Password
                    </button>
                    <div className="mx-2 my-1 border-t border-border" />
                    <button
                      onClick={() => signOut()}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground/80 hover:bg-accent"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Link
                  href="/auth/signup"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
                >
                  <UserPlus size={14} />
                  Sign Up
                </Link>
                <button
                  onClick={() => signIn()}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-brand-ink transition-colors hover:bg-accent"
                >
                  <LogIn size={14} />
                  Sign In
                </button>
              </>
            )}
          </div>
          </NavigationMenu>
      </nav>
      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
      />
    </>
  );
}
