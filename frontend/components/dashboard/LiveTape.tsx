"use client";

import { type RiskEvent } from "@/lib/api";
import { cn } from "@/lib/utils";

const severityColor: Record<string, string> = {
  critical: "text-signal-critical",
  high: "text-signal-high",
  medium: "text-signal-medium",
  low: "text-signal-low",
};
const severityDot: Record<string, string> = {
  critical: "bg-signal-critical",
  high: "bg-signal-high",
  medium: "bg-signal-medium",
  low: "bg-signal-low",
};

function sourceLabel(s: string) {
  return s === "CompanyReport" ? "RPT" : s.slice(0, 4).toUpperCase();
}

export function LiveTape({
  events,
  onSelect,
  pendingMode = false,
}: {
  events: RiskEvent[];
  onSelect: (company: string, ticker: string) => void;
  pendingMode?: boolean;
}) {
  return (
    <div className="divide-y divide-border">
      {events.map((ev) => {
        const score = ev.exposure_score || ev.risk_score;
        return (
          <button
            key={ev.id}
            type="button"
            onClick={() => onSelect(ev.company, ev.ticker)}
            className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-primary/[0.04]"
          >
            <span className="w-16 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              {ev.event_date.slice(5)}
            </span>
            <span className="w-10 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {sourceLabel(ev.source_type)}
            </span>
            <span className="w-14 shrink-0 font-mono text-xs font-bold uppercase tracking-wider text-foreground">
              {ev.ticker}
            </span>
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", severityDot[ev.severity])} />
            <span className="hidden w-24 shrink-0 truncate text-xs text-muted-foreground sm:inline">
              {ev.topic_label}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-foreground/85">{ev.title}</span>
            <span
              className={cn(
                "shrink-0 font-mono text-sm font-bold tabular-nums",
                pendingMode ? "text-muted-foreground" : severityColor[ev.severity],
              )}
            >
              {pendingMode ? "—" : score}
            </span>
          </button>
        );
      })}
    </div>
  );
}
