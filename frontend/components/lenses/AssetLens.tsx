"use client";

import { useState } from "react";
import { Brain, Gauge, LineChart, ListFilter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventsTable } from "@/components/dashboard/EventsTable";
import { IssuerWatchlist } from "@/components/dashboard/IssuerWatchlist";
import { ScoringMethodologyCard } from "@/components/dashboard/ScoringMethodologyCard";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { KpiTape } from "@/components/shell/KpiTape";
import { type DashboardData } from "@/lib/api";
import { companyKey, type DerivedDashboard } from "@/lib/derive";
import { type Theme } from "@/lib/theme";

const PAGE_SIZE = 8;

function exposureTone(v: number) {
  if (v >= 75) return "critical" as const;
  if (v >= 62) return "high" as const;
  if (v >= 50) return "medium" as const;
  return "low" as const;
}

// Full class strings so Tailwind's content scanner keeps them.
const SIGNAL_TEXT = {
  critical: "text-signal-critical",
  high: "text-signal-high",
  medium: "text-signal-medium",
  low: "text-signal-low",
} as const;
const SIGNAL_BG = {
  critical: "bg-signal-critical",
  high: "bg-signal-high",
  medium: "bg-signal-medium",
  low: "bg-signal-low",
} as const;

export function AssetLens({
  data,
  d,
  theme,
  onSelect,
  rawIngestionView,
  realIngestionMode,
}: {
  data: DashboardData;
  d: DerivedDashboard;
  theme: Theme;
  onSelect: (company: string, ticker: string) => void;
  rawIngestionView: boolean;
  realIngestionMode: boolean;
}) {
  const [page, setPage] = useState(0);
  const sel = d.selectedExposure;
  if (!sel) return null;

  const tone = exposureTone(sel.exposure);
  const paged = d.visibleEvents.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const exposureData = rawIngestionView
    ? data.exposure_by_company.map((e) => ({ ...e, exposure: e.event_count }))
    : data.exposure_by_company;

  return (
    <div className="grid gap-3 lg:grid-cols-[230px_1fr]">
      <Card className="hidden self-start overflow-hidden p-0 lg:block">
        <IssuerWatchlist
          items={exposureData}
          selectedCompany={companyKey(sel.company, sel.ticker)}
          onSelect={onSelect}
          onOpenDetail={onSelect}
          metricLabel={rawIngestionView ? "events" : "exposure"}
          colorize={!rawIngestionView}
        />
      </Card>

      <div className="space-y-3">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xl font-bold uppercase tracking-wider text-foreground">
                  {sel.ticker}
                </span>
                <Badge>Equity</Badge>
                <Badge variant={tone}>{tone}</Badge>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{sel.company}</div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="eyebrow">{rawIngestionView ? "Signals" : "Exposure"}</div>
                <div className={`font-mono text-4xl font-bold tabular-nums ${SIGNAL_TEXT[tone]}`}>
                  {sel.exposure}
                </div>
              </div>
              <div className="text-right">
                <div className="eyebrow">Confidence</div>
                <div className="font-mono text-2xl font-bold tabular-nums text-foreground">
                  {Math.round(d.averageConfidence * 100)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <KpiTape
          items={[
            { label: "Evidence", value: String(d.evidenceCount) },
            { label: "Top Topic", value: d.topIncreasingTopic },
            { label: "Trend", value: d.trendSummary.replace(/ over the.*$/, "") },
            { label: "Drivers", value: String(d.topDrivers.length) },
            { label: "Top Driver", value: d.topDrivers[0]?.topic ?? "—" },
            { label: "Avg Conf", value: `${Math.round(d.averageConfidence * 100)}%` },
          ]}
        />

        <div className="grid gap-3 lg:grid-cols-[1fr_0.7fr]">
          <Card>
            <CardHeader className="justify-between">
              <CardTitle>Risk Drivers</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-foreground/80">{d.riskSummary}</p>
              <div className="mt-4 space-y-2">
                {d.topDrivers.map((ev) => (
                  <div key={ev.id} className="rounded-sm border border-border bg-panel p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">{ev.topic}</span>
                      <Badge variant={ev.severity}>{ev.severity}</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {ev.risk_driver_summary || ev.title}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Card>
              <CardHeader className="justify-between">
                <CardTitle>Topic Breakdown</CardTitle>
                <Gauge className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-1.5">
                {d.topicScores.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No scored topics yet.</p>
                ) : (
                  d.topicScores.slice(0, 6).map((t) => (
                    <div key={t.topic} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 truncate text-xs text-foreground/80">{t.topic}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${SIGNAL_BG[exposureTone(t.score)]}`}
                          style={{ width: `${Math.min(100, t.score)}%` }}
                        />
                      </div>
                      <span className="w-7 shrink-0 text-right font-mono text-xs tabular-nums text-foreground">
                        {t.score}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <ScoringMethodologyCard realIngestionMode={realIngestionMode} pendingMode={rawIngestionView} />
          </div>
        </div>

        {!rawIngestionView && (
          <Card>
            <CardHeader className="justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle>{sel.ticker} Risk Trend</CardTitle>
                <p className="text-xs text-muted-foreground">{d.trendSummary}</p>
              </div>
              <LineChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="h-64">
              <TrendChart data={d.trendByDate} selectedCompany={companyKey(sel.company, sel.ticker)} theme={theme} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="justify-between">
            <CardTitle>Evidence · {sel.ticker}</CardTitle>
            <ListFilter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <EventsTable
              events={paged}
              page={page}
              pageSize={PAGE_SIZE}
              total={d.visibleEvents.length}
              onPageChange={setPage}
              onEventClick={(ev) => onSelect(ev.company, ev.ticker)}
              scorePendingMode={rawIngestionView}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
