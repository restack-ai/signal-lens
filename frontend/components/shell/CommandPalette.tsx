"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";

import { type CompanyExposure } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LENSES, type LensId } from "./lenses";

type Command = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords: string;
  run: () => void;
};

export function CommandPalette({
  open,
  onClose,
  assets,
  onSelectAsset,
  onLens,
  onToggleTheme,
}: {
  open: boolean;
  onClose: () => void;
  assets: CompanyExposure[];
  onSelectAsset: (company: string, ticker: string) => void;
  onLens: (lens: LensId) => void;
  onToggleTheme: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const lensCmds: Command[] = LENSES.filter((l) => !l.contextual).map((l) => ({
      id: `lens:${l.id}`,
      group: "Lenses",
      label: `Go to ${l.label}`,
      hint: l.short,
      keywords: `${l.label} ${l.short} lens view`,
      run: () => onLens(l.id),
    }));
    const assetCmds: Command[] = assets.map((a) => ({
      id: `asset:${a.ticker}`,
      group: "Assets",
      label: a.company,
      hint: `${a.ticker} · exp ${a.exposure}`,
      keywords: `${a.company} ${a.ticker}`,
      run: () => onSelectAsset(a.company, a.ticker),
    }));
    const actionCmds: Command[] = [
      {
        id: "action:theme",
        group: "Actions",
        label: "Toggle light / dark theme",
        hint: "THEME",
        keywords: "theme dark light mode toggle appearance",
        run: onToggleTheme,
      },
    ];
    return [...lensCmds, ...assetCmds, ...actionCmds];
  }, [assets, onLens, onSelectAsset, onToggleTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.keywords.toLowerCase().includes(q));
  }, [commands, query]);

  // Parent remounts via `key` on open, so query/active start fresh — no
  // state-resetting effect needed. This effect only moves focus (no setState).
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  if (!open) return null;

  function runActive() {
    const cmd = filtered[active];
    if (cmd) {
      cmd.run();
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-background/60 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-md border border-border-strong bg-card shadow-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                runActive();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="Jump to an asset, switch lens, or run an action…"
            className="h-12 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="rounded-sm border border-border-strong px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center font-mono text-xs text-muted-foreground">
              No matches for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((cmd, i) => {
              const showGroup = i === 0 || filtered[i - 1].group !== cmd.group;
              return (
                <div key={cmd.id}>
                  {showGroup && (
                    <div className="px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {cmd.group}
                    </div>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={runActive}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-sm px-2.5 py-2 text-left text-sm transition-colors",
                      i === active
                        ? "bg-primary/10 text-foreground"
                        : "text-foreground/80 hover:bg-muted",
                    )}
                  >
                    <span className="truncate">{cmd.label}</span>
                    <span className="flex items-center gap-2">
                      {cmd.hint && (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {cmd.hint}
                        </span>
                      )}
                      {i === active && (
                        <CornerDownLeft className="h-3 w-3 text-muted-foreground" />
                      )}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
