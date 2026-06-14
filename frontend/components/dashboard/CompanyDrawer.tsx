"use client";

import { PanelRightOpen, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { type RiskEvent } from "@/lib/api";

function sourceLabel(sourceType: string) {
  return sourceType === "CompanyReport" ? "Company report" : sourceType;
}

function confidenceLabel(value: number) {
  if (value >= 0.86) return "high";
  if (value >= 0.78) return "medium-high";
  if (value >= 0.68) return "medium";
  return "low";
}

function dedupeEvents(events: RiskEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const normalizedTitle = event.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const key = event.content_hash ?? `${event.source_url}:${normalizedTitle}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function DriverStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-semibold">{value}</div>
    </div>
  );
}

export function CompanyDrawer({
  company,
  events,
  onClose,
  exposure,
  riskSummary,
  ticker,
  topicScores,
  trendSummary,
  averageConfidence,
}: {
  company: string | null;
  events: RiskEvent[];
  onClose: () => void;
  exposure?: number;
  riskSummary?: string;
  ticker?: string;
  topicScores?: { topic: string; score: number }[];
  trendSummary?: string;
  averageConfidence?: number;
}) {
  if (!company) return null;

  const materialEvents = dedupeEvents(events);
  const latestEvents = materialEvents.slice(0, 4);
  const evidenceEvents = materialEvents.slice(0, 8);
  const hiddenEvidenceCount = Math.max(materialEvents.length - evidenceEvents.length, 0);
  const avgConf = averageConfidence ?? 0;
  const topTopic = topicScores?.[0]?.topic ?? "regulation";

  const questions = [
    "What changed in the last 30 days?",
    "Which events caused the risk score to increase?",
    "How does this company compare with peers?",
    `Show only ${topTopic.toLowerCase()}-related events.`,
  ];

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l border-border bg-white shadow-xl">
      <div className="flex items-start justify-between border-b border-border p-5">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <PanelRightOpen className="h-4 w-4" />
            Company Detail
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            {company}
          </h2>
          {ticker ? (
            <p className="text-sm text-muted-foreground">{ticker}</p>
          ) : null}
        </div>
        <button
          className="rounded-md p-2 hover:bg-slate-100"
          onClick={onClose}
          type="button"
          aria-label="Close company detail"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-5 overflow-y-auto p-5">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <DriverStat label="Exposure" value={exposure?.toString() ?? "—"} />
          <DriverStat label="Evidence" value={materialEvents.length.toString()} />
          <DriverStat
            label="Confidence"
            value={`${Math.round(avgConf * 100)}%`}
          />
        </div>

        {riskSummary ? (
          <section>
            <h3 className="text-sm font-semibold">
              AI-style company risk summary
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {riskSummary}
            </p>
          </section>
        ) : null}

        {topicScores && topicScores.length > 0 ? (
          <section>
            <h3 className="text-sm font-semibold">Top risk topics</h3>
            <div className="mt-3 grid gap-2">
              {topicScores.slice(0, 4).map((item) => (
                <div
                  className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm"
                  key={item.topic}
                >
                  <span>{item.topic}</span>
                  <span className="font-semibold">{item.score}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {trendSummary ? (
          <section>
            <h3 className="text-sm font-semibold">30-day trend summary</h3>
            <p className="mt-2 text-sm text-muted-foreground">{trendSummary}</p>
          </section>
        ) : null}

        <section>
          <h3 className="text-sm font-semibold">Latest related events</h3>
          <div className="mt-3 grid gap-3">
            {latestEvents.map((event) => (
              <div
                className="rounded-md border border-border p-3"
                key={event.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{event.title}</span>
                  <Badge variant={event.severity}>{event.severity}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {event.summary}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Search className="h-4 w-4" />
            Evidence list
          </h3>
          <div className="mt-3 grid gap-3">
            {evidenceEvents.map((event) => (
              <div className="rounded-md bg-slate-50 p-3" key={event.id}>
                <div className="text-xs font-medium text-muted-foreground">
                  {sourceLabel(event.source_type)} · {event.source_name} ·
                  extracted {event.extracted_at.slice(0, 10)}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {event.evidence_excerpt}
                </p>
              </div>
            ))}
            {hiddenEvidenceCount ? (
              <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                {hiddenEvidenceCount} additional material events hidden from this compact evidence view.
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold">
            Suggested follow-up questions
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {questions.map((question) => (
              <span
                className="rounded-md border border-border bg-slate-50 px-3 py-2 text-xs font-medium text-muted-foreground"
                key={question}
              >
                {question}
              </span>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
