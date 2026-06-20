"use client";

import { useMemo, useState } from "react";
import { Activity } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventsTable } from "@/components/dashboard/EventsTable";
import { cn } from "@/lib/utils";
import { type DashboardData, type RiskEvent } from "@/lib/api";

const PAGE_SIZE = 12;
const SEVERITIES: Array<RiskEvent["severity"] | "all"> = ["all", "critical", "high", "medium", "low"];

export function FeedLens({
  data,
  onSelect,
  rawIngestionView,
}: {
  data: DashboardData;
  onSelect: (company: string, ticker: string) => void;
  rawIngestionView: boolean;
}) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<RiskEvent["severity"] | "all">("all");

  const filtered = useMemo(
    () => (filter === "all" ? data.latest_events : data.latest_events.filter((e) => e.severity === filter)),
    [data.latest_events, filter],
  );
  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="justify-between">
        <CardTitle className="flex items-center gap-2">
          <span className="signal-pulse h-1.5 w-1.5 rounded-full bg-primary" />
          Live Feed
        </CardTitle>
        <div className="flex items-center gap-1">
          {SEVERITIES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setFilter(s);
                setPage(0);
              }}
              className={cn(
                "rounded-sm border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors",
                filter === s
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
          <Activity className="ml-1 h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <EventsTable
          events={paged}
          page={page}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
          onEventClick={(ev) => onSelect(ev.company, ev.ticker)}
          scorePendingMode={rawIngestionView}
        />
      </CardContent>
    </Card>
  );
}
