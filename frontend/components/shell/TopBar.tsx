"use client";

import { useEffect, useState } from "react";
import { Activity, Search } from "lucide-react";

import { clearToken, getStoredToken } from "@/lib/auth";
import { getMe } from "@/lib/api";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar({
  onOpenPalette,
  realIngestionMode,
  feedRate,
}: {
  onOpenPalette: () => void;
  realIngestionMode: boolean;
  feedRate: number;
}) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    getMe()
      .then((user) => setEmail(user.email))
      .catch(() => {});
  }, []);

  function handleLogout() {
    clearToken();
    window.location.reload();
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border-strong bg-background/90 px-3 backdrop-blur">
      <span className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-[0.18em] text-foreground">
        <Activity className="h-4 w-4 text-primary" />
        Signal<span className="text-primary">Lens</span>
      </span>

      <button
        type="button"
        onClick={onOpenPalette}
        className="group flex h-8 max-w-md flex-1 items-center gap-2 rounded-sm border border-border bg-panel px-3 text-left text-sm text-muted-foreground transition-colors hover:border-border-strong"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 truncate">Search assets, themes, or ask the Lens…</span>
        <kbd className="rounded-sm border border-border-strong px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden items-center gap-1.5 md:inline-flex">
          <span className="signal-pulse h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {realIngestionMode ? "Live ingest" : "Seeded"} · {feedRate}/h
          </span>
        </span>
        <ThemeToggle />
        {email ? (
          <>
            <span className="hidden font-mono text-xs text-muted-foreground lg:inline">
              {email}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-sm border border-border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:border-border-strong hover:text-foreground"
            >
              Logout
            </button>
          </>
        ) : (
          <a
            href="/login"
            className="rounded-sm border border-border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:border-border-strong hover:text-foreground"
          >
            Login
          </a>
        )}
      </div>
    </header>
  );
}
