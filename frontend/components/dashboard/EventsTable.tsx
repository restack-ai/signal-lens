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
  critical: "#dc2626",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#0f766e",
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
}: {
  events: RiskEvent[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onEventClick?: (event: RiskEvent) => void;
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
                Score
              </TableHead>
              <TableHead scope="col">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {event.event_date}
                </TableCell>
                <TableCell>
                  <button
                    className="font-medium text-slate-950 hover:text-primary"
                    onClick={() => onEventClick?.(event)}
                    type="button"
                  >
                    {event.company}
                  </button>
                  <div className="text-xs text-muted-foreground">
                    {event.ticker}
                  </div>
                </TableCell>
                <TableCell>{event.topic_label}</TableCell>
                <TableCell>
                  <Badge variant={event.severity}>{event.severity}</Badge>
                </TableCell>
                <TableCell className="min-w-[360px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{event.title}</span>
                    <Badge>{sourceLabel(event.source_type)}</Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {event.evidence_excerpt}
                  </p>
                  <a
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"
                    href={event.source_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {event.source_name}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </TableCell>
                <TableCell
                  className="text-right font-semibold"
                  style={{ color: severityFill[event.severity] }}
                >
                  {event.exposure_score}
                </TableCell>
                <TableCell className="min-w-[240px] text-xs leading-5 text-muted-foreground">
                  {event.suggested_action}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {total > pageSize ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {start}–{end} of {total} events
          </span>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
              type="button"
            >
              Previous
            </button>
            <button
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
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
