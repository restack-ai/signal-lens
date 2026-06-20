"use client";

import { Fragment } from "react";

import { type TopicHeatmapCell } from "@/lib/api";
import { cn } from "@/lib/utils";

function heatColor(score: number) {
  if (score >= 78) return "bg-signal-critical text-background";
  if (score >= 66) return "bg-signal-high text-background";
  if (score >= 54) return "bg-signal-medium text-background";
  if (score > 0) return "bg-signal-low/15 text-signal-low ring-1 ring-inset ring-signal-low/25";
  return "bg-muted/40 text-muted-foreground/40";
}

const TOPICS = [
  { label: "Regulation", short: "REG" },
  { label: "Litigation", short: "LIT" },
  { label: "Cybersecurity", short: "CYB" },
  { label: "Labor", short: "LAB" },
  { label: "Supply Chain", short: "SUP" },
  { label: "Climate", short: "CLI" },
  { label: "Accounting", short: "ACC" },
  { label: "Product Safety", short: "SAF" },
  { label: "Management", short: "MGT" },
  { label: "Geopolitics", short: "GEO" },
];

export function TopicHeatmap({
  data,
  companies,
  selectedCompany,
  onCellClick,
}: {
  data: TopicHeatmapCell[];
  companies: string[];
  topics?: string[];
  selectedCompany?: string | null;
  onCellClick?: (company: string, topic: string) => void;
}) {
  const heatmapLookup = new Map(
    data.map((cell) => [`${cell.company}:${cell.topic}`, cell]),
  );

  return (
    <div role="grid" aria-label="Risk topic heatmap" className="overflow-x-auto">
      <div
        className="grid min-w-[760px] gap-1"
        style={{ gridTemplateColumns: "160px repeat(10, 1fr)" }}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Issuer
        </div>
        {TOPICS.map((topic) => (
          <div
            key={topic.label}
            className="truncate text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
            title={topic.label}
          >
            {topic.short}
          </div>
        ))}
        {companies.map((company) => {
          const isSelected = selectedCompany === company;
          return (
            <Fragment key={company}>
              <button
                className={cn(
                  "truncate rounded-sm px-1.5 py-1 text-left text-xs font-medium text-foreground/80 hover:bg-muted/60 hover:text-foreground",
                  isSelected &&
                    "bg-primary/15 text-primary ring-1 ring-inset ring-primary/40 hover:bg-primary/15",
                )}
                onClick={() => onCellClick?.(company, "")}
                type="button"
              >
                {company}
              </button>
              {TOPICS.map((topic) => {
                const cell = heatmapLookup.get(`${company}:${topic.label}`);
                const score = cell?.score ?? 0;
                return (
                  <button
                    key={`${company}-${topic.label}`}
                    role="gridcell"
                    aria-label={`${company} ${topic.label}: score ${score}`}
                    title={`${company} ${topic.label}: ${score}`}
                    className={cn(
                      "flex h-7 items-center justify-center rounded-sm font-mono text-[11px] font-semibold tabular-nums transition-shadow hover:ring-2 hover:ring-primary",
                      heatColor(score),
                    )}
                    onClick={() => onCellClick?.(company, topic.label)}
                    type="button"
                  >
                    {cell?.score ?? "·"}
                  </button>
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
