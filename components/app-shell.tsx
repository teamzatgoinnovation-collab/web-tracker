"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { AppShellLayout, Button, type AppShellNavItem } from "@zatgo/ui";
import { ClipboardList, LayoutDashboard, Moon, Settings, Sun } from "@zatgo/icons";
import { useSessionStore } from "@/store/session";
import { logoutFromErpnext } from "@/lib/client";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

const nav: AppShellNavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { href: "/projects", label: "Projects", icon: ClipboardList },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/connection", label: "Connection", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const connected = useSessionStore((s) => s.connected);
  const user = useSessionStore((s) => s.user);
  const fullName = useSessionStore((s) => s.fullName);
  const mode = theme ?? "system";
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await logoutFromErpnext();
      toast.success("Signed out");
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <AppShellLayout
      productTitle="Project Tracker"
      nav={nav}
      pathname={pathname}
      renderLink={({ href, className, children: linkChildren }) => (
        <Link href={href} className={className}>
          {linkChildren}
        </Link>
      )}
      sidebarFooter={
        <>
          <p
            className="truncate font-medium text-[var(--color-foreground)]"
            title={fullName ?? user ?? undefined}
          >
            {connected ? fullName || user : "Not signed in"}
          </p>
          <p className="truncate">{connected ? "Connected" : "Not connected"}</p>
        </>
      }
      headerActions={
        <>
          <Button variant="outline" disabled={signingOut} onClick={() => void onSignOut()}>
            Sign out
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              setTheme(mode === "light" ? "dark" : mode === "dark" ? "system" : "light")
            }
          >
            {mode === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            Theme: {mode}
          </Button>
        </>
      }
    >
      {children}
    </AppShellLayout>
  );
}
