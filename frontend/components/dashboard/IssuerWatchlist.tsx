"use client";

import { type CompanyExposure } from "@/lib/api";
import { cn } from "@/lib/utils";

function companyKey(company: string, ticker: string) {
  return `${company}:${ticker}`;
}

// Maps an exposure score to a signal tier (text + meter colors).
function tier(value: number) {
  if (value >= 75) return { dot: "bg-signal-critical", bar: "bg-signal-critical", text: "text-signal-critical" };
  if (value >= 62) return { dot: "bg-signal-high", bar: "bg-signal-high", text: "text-signal-high" };
  if (value >= 50) return { dot: "bg-signal-medium", bar: "bg-signal-medium", text: "text-signal-medium" };
  return { dot: "bg-signal-low", bar: "bg-signal-low", text: "text-signal-low" };
}

export function IssuerWatchlist({
  items,
  selectedCompany,
  onSelect,
  onOpenDetail,
  metricLabel,
  colorize = true,
}: {
  items: CompanyExposure[];
  selectedCompany: string | null;
  onSelect: (company: string, ticker: string) => void;
  onOpenDetail: (company: string, ticker: string) => void;
  metricLabel: string;
  colorize?: boolean;
}) {
  const ranked = [...items].sort((a, b) => b.exposure - a.exposure);
  const max = Math.max(...ranked.map((i) => i.exposure), 1);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border bg-panel px-3 py-2.5">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
          Issuers
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {ranked.length} · {metricLabel}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {ranked.map((item, i) => {
          const key = companyKey(item.company, item.ticker);
          const isSelected = selectedCompany === key;
          const t = colorize ? tier(item.exposure) : { dot: "bg-primary", bar: "bg-primary", text: "text-primary" };
          const pct = Math.max(4, Math.round((item.exposure / max) * 100));
          return (
            <div
              key={key}
              className={cn(
                "group relative flex cursor-pointer items-center gap-2.5 border-b border-border/60 px-3 py-2 transition-colors hover:bg-primary/[0.05]",
                isSelected && "bg-primary/[0.08]",
              )}
              onClick={() => onSelect(item.company, item.ticker)}
            >
              <span
                className={cn(
                  "absolute inset-y-0 left-0 w-0.5",
                  isSelected ? "bg-primary" : "bg-transparent",
                )}
              />
              <span className="w-4 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                    {item.ticker}
                  </span>
                  <span className={cn("font-mono text-sm font-bold tabular-nums", t.text)}>
                    {item.exposure}
                  </span>
                </div>
                <div className="truncate text-[11px] text-muted-foreground">{item.company}</div>
                <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", t.bar)} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <button
                className="shrink-0 rounded-sm border border-transparent px-1 py-0.5 font-mono text-[10px] uppercase text-muted-foreground opacity-0 transition-opacity hover:border-border hover:text-foreground group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail(item.company, item.ticker);
                }}
                type="button"
                aria-label={`Open ${item.ticker} detail`}
              >
                ▸
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
