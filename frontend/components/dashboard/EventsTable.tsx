"use client";

import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type RiskEvent } from "@/lib/api";

const severityFill: Record<string, string> = {
  critical: "#f04438",
  high: "#fb923c",
  medium: "#fbbf24",
  low: "#34d399",
};

function sourceLabel(sourceType: string) {
  return sourceType === "CompanyReport" ? "Company report" : sourceType;
}

export function EventsTable({
  events,
  page,
  pageSize,
  total,
  onPageChange,
  onEventClick,
  scorePendingMode = false,
}: {
  events: RiskEvent[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onEventClick?: (event: RiskEvent) => void;
  scorePendingMode?: boolean;
}) {
  const start = page * pageSize + 1;
  const end = Math.min(page * pageSize + pageSize, total);
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Date</TableHead>
              <TableHead scope="col">Company</TableHead>
              <TableHead scope="col">Topic</TableHead>
              <TableHead scope="col">Severity</TableHead>
              <TableHead scope="col">Evidence</TableHead>
              <TableHead scope="col" className="text-right">
                {scorePendingMode ? "Extraction" : "Score"}
              </TableHead>
              <TableHead scope="col">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                  {event.event_date}
                </TableCell>
                <TableCell>
                  <button
                    className="font-medium text-foreground hover:text-primary"
                    onClick={() => onEventClick?.(event)}
                    type="button"
                  >
                    {event.company}
                  </button>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {event.ticker}
                  </div>
                </TableCell>
                <TableCell className="text-foreground/80">{event.topic_label}</TableCell>
                <TableCell>
                  <Badge variant={event.severity}>{event.severity}</Badge>
                </TableCell>
                <TableCell className="min-w-[360px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{event.title}</span>
                    <Badge>{sourceLabel(event.source_type)}</Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {event.evidence_excerpt}
                  </p>
                  <a
                    className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] font-medium text-primary hover:underline"
                    href={event.source_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {event.source_name}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </TableCell>
                <TableCell
                  className="text-right font-mono text-base font-bold tabular-nums"
                  style={{ color: scorePendingMode ? undefined : severityFill[event.severity] }}
                >
                  {scorePendingMode ? (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Pending
                    </span>
                  ) : (
                    event.exposure_score || event.risk_score
                  )}
                </TableCell>
                <TableCell className="min-w-[240px] text-xs leading-5 text-muted-foreground">
                  {event.suggested_action || (scorePendingMode ? "Run extraction/scoring" : "")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {total > pageSize ? (
        <div className="flex items-center justify-between border-t border-border pt-3 font-mono text-xs text-muted-foreground">
          <span className="tabular-nums">
            Showing {start}–{end} of {total} events
          </span>
          <div className="flex gap-2">
            <button
              className="rounded-sm border border-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:border-border-strong hover:text-foreground disabled:opacity-30"
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
              type="button"
            >
              Previous
            </button>
            <button
              className="rounded-sm border border-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:border-border-strong hover:text-foreground disabled:opacity-30"
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange(page + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
