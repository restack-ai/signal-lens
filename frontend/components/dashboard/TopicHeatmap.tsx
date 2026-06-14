"use client";

import { Fragment } from "react";

import { type TopicHeatmapCell } from "@/lib/api";
import { cn } from "@/lib/utils";

function heatColor(score: number) {
  if (score >= 78) return "bg-red-500 text-white";
  if (score >= 66) return "bg-orange-400 text-white";
  if (score >= 54) return "bg-amber-300 text-slate-950";
  if (score > 0) return "bg-teal-100 text-teal-950";
  return "bg-slate-100 text-slate-400";
}

const TOPICS = [
  { label: "Regulation", short: "Reg" },
  { label: "Litigation", short: "Lit" },
  { label: "Cybersecurity", short: "Cyb" },
  { label: "Labor", short: "Lab" },
  { label: "Supply Chain", short: "Sup" },
  { label: "Climate", short: "Cli" },
  { label: "Accounting", short: "Acc" },
  { label: "Product Safety", short: "Saf" },
  { label: "Management", short: "Mgt" },
  { label: "Geopolitics", short: "Geo" },
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
    <div
      role="grid"
      aria-label="Risk topic heatmap"
      className="overflow-x-auto"
    >
      <div
        className="grid min-w-[760px] gap-1"
        style={{ gridTemplateColumns: "154px repeat(10, 46px)" }}
      >
        <div className="text-xs font-medium text-muted-foreground">Company</div>
        {TOPICS.map((topic) => (
          <div
            key={topic.label}
            className="truncate text-xs text-muted-foreground"
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
                  "truncate rounded-sm px-1 text-left text-sm font-medium hover:bg-slate-100",
                  isSelected && "bg-slate-900 text-white hover:bg-slate-900",
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
                    className={`flex h-8 items-center justify-center rounded-sm text-xs font-semibold ring-offset-2 hover:ring-2 hover:ring-primary ${heatColor(score)}`}
                    onClick={() => onCellClick?.(company, topic.label)}
                    type="button"
                  >
                    {cell?.score ?? "-"}
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
