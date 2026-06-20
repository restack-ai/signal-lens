"use client";

import { Activity, Brain, Building2, Database, Layers } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExposureChart } from "@/components/dashboard/ExposureChart";
import { IssuerWatchlist } from "@/components/dashboard/IssuerWatchlist";
import { LiveTape } from "@/components/dashboard/LiveTape";
import { TopicHeatmap } from "@/components/dashboard/TopicHeatmap";
import { KpiTape } from "@/components/shell/KpiTape";
import { type DashboardData } from "@/lib/api";
import { type DerivedDashboard } from "@/lib/derive";
import { type Theme } from "@/lib/theme";

export function OverviewLens({
  data,
  d,
  theme,
  onSelect,
  onOpenAsset,
  rawIngestionView,
}: {
  data: DashboardData;
  d: DerivedDashboard;
  theme: Theme;
  onSelect: (company: string, ticker: string) => void;
  onOpenAsset: (company: string, ticker: string) => void;
  rawIngestionView: boolean;
}) {
  const peak = data.exposure_by_company.reduce((m, e) => Math.max(m, e.exposure), 0);
  const exposureData = rawIngestionView
    ? data.exposure_by_company.map((e) => ({ ...e, exposure: e.event_count }))
    : data.exposure_by_company;
  const heatData = rawIngestionView
    ? data.topic_heatmap.map((c) => ({ ...c, score: c.event_count }))
    : data.topic_heatmap;

  return (
    <div className="space-y-3">
      <KpiTape
        items={[
          { label: rawIngestionView ? "Avg Signals" : "Avg Exposure", value: String(d.averageExposure), tone: "primary" },
          { label: "Peak", value: String(peak), tone: peak >= 75 ? "critical" : "high" },
          { label: "Assets", value: String(data.exposure_by_company.length) },
          { label: "Evidence", value: String(d.eventCount) },
          { label: "Top Topic", value: d.topIncreasingTopic },
          { label: "Avg Confidence", value: `${Math.round(d.averageConfidence * 100)}%` },
        ]}
      />

      <Card>
        <CardHeader className="justify-between">
          <CardTitle>Portfolio Briefing</CardTitle>
          <Brain className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-foreground/80">{data.ai_summary.body}</p>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader className="justify-between">
            <CardTitle>{rawIngestionView ? "Ingested Events by Asset" : "Exposure Distribution"}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="h-80">
            <ExposureChart
              data={exposureData}
              selectedCompany={null}
              theme={theme}
              onSelect={(key) => {
                const i = key.indexOf(":");
                onOpenAsset(key.slice(0, i), key.slice(i + 1));
              }}
            />
          </CardContent>
        </Card>

        <Card className="overflow-hidden p-0">
          <IssuerWatchlist
            items={exposureData}
            selectedCompany={null}
            onSelect={onOpenAsset}
            onOpenDetail={onOpenAsset}
            metricLabel={rawIngestionView ? "events" : "exposure"}
            colorize={!rawIngestionView}
          />
        </Card>
      </div>

      <Card>
        <CardHeader className="justify-between">
          <CardTitle>{rawIngestionView ? "Ingested Topic Counts" : "Risk Topic Heatmap"}</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <TopicHeatmap
            data={heatData}
            companies={data.exposure_by_company.map((e) => e.company)}
            selectedCompany={null}
            onCellClick={(company) => {
              const e = data.exposure_by_company.find((x) => x.company === company);
              if (e) onOpenAsset(e.company, e.ticker);
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="justify-between">
          <CardTitle className="flex items-center gap-2">
            <span className="signal-pulse h-1.5 w-1.5 rounded-full bg-primary" />
            Live Signal Tape
          </CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-0">
          <LiveTape events={data.latest_events.slice(0, 12)} onSelect={onSelect} pendingMode={rawIngestionView} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-2 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <Layers className="h-3 w-3" />
        Equities · multi-asset coverage expanding
      </div>
    </div>
  );
}
