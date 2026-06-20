"use client";

import { Command } from "lucide-react";

import { cn } from "@/lib/utils";
import { LENSES, type LensId } from "./lenses";

export function NavRail({
  active,
  onChange,
  onOpenPalette,
}: {
  active: LensId;
  onChange: (lens: LensId) => void;
  onOpenPalette: () => void;
}) {
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border-strong bg-panel py-3">
      {LENSES.filter((l) => !l.contextual).map((lens) => {
        const Icon = lens.icon;
        const isActive = active === lens.id;
        return (
          <button
            key={lens.id}
            type="button"
            onClick={() => onChange(lens.id)}
            title={lens.label}
            aria-label={lens.label}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-md transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
            )}
            <Icon className="h-4 w-4" />
            <span className="font-mono text-[8px] font-semibold uppercase tracking-wider">
              {lens.short}
            </span>
          </button>
        );
      })}
      <div className="mt-auto">
        <button
          type="button"
          onClick={onOpenPalette}
          title="Command palette (⌘K)"
          aria-label="Open command palette"
          className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Command className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
