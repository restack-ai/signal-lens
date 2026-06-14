"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Brain, Building2, Database, Globe2, ListFilter, ShieldAlert, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Spinner } from "@/components/ui/spinner";
import { CompanyDrawer } from "@/components/dashboard/CompanyDrawer";
import { EventsTable } from "@/components/dashboard/EventsTable";
import { ExposureChart } from "@/components/dashboard/ExposureChart";
import { ScoringMethodologyCard } from "@/components/dashboard/ScoringMethodologyCard";
import { TopicHeatmap } from "@/components/dashboard/TopicHeatmap";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { type DashboardData, getDashboard } from "@/lib/api";
import { companyKey, deriveDashboard } from "@/lib/derive";

const PAGE_SIZE = 10;
const TOPIC_MAP: Record<string, string> = { Regulation:"Reg",Litigation:"Lit",Cybersecurity:"Cyb",Labor:"Lab","Supply Chain":"Sup",Climate:"Cli",Accounting:"Acc","Product Safety":"Saf",Management:"Mgt",Geopolitics:"Geo" };
const REAL_INGESTION_MODE = process.env.NEXT_PUBLIC_REAL_INGESTION_MODE === "true";

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-slate-50 p-3"><div className="text-muted-foreground">{label}</div><div className="mt-1 truncate text-xl font-semibold">{value}</div></div>;
}
function Tile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-slate-50 p-3"><div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</div><div className="mt-2 line-clamp-3 text-sm font-semibold leading-5">{value}</div></div>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 truncate font-semibold">{value}</div></div>;
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(0);

  function fetchData() {
    setLoading(true); setError(null);
    getDashboard().then((d) => { setData(d); setLoading(false); }).catch((e: Error) => { setError(e.message); setLoading(false); });
  }
  // State is set inside the async .then/.catch callbacks (not synchronously in
  // the effect body), and loading defaults to true, so no setState on mount.
  useEffect(() => {
    getDashboard().then((d) => { setData(d); setLoading(false); }).catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  const d = useMemo(
    () => (data ? deriveDashboard(data, selectedCompany, { realIngestionMode: REAL_INGESTION_MODE }) : null),
    [data, selectedCompany],
  );

  function pick(company: string, ticker: string, drawer = true) { setSelectedCompany(companyKey(company, ticker)); setDrawerOpen(drawer); setPage(0); }
  function clear() { setSelectedCompany(null); setDrawerOpen(false); setPage(0); }

  if (loading) return <main className="flex min-h-screen items-center justify-center p-6"><div className="flex flex-col items-center gap-4"><Spinner /><p className="text-sm text-muted-foreground">{REAL_INGESTION_MODE ? "Fetching ingested public-source risk signals…" : "Fetching seeded mock risk intelligence…"}</p></div></main>;
  if (error || !data || !d) return <main className="flex min-h-screen items-center justify-center p-6"><div className="w-full max-w-lg"><ErrorBanner message={error ?? "Unknown error."} onRetry={fetchData} /></div></main>;

  const sel = d.selectedExposure;
  const isSelected = Boolean(selectedCompany);
  const paged = d.visibleEvents.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const rawIngestionView = REAL_INGESTION_MODE && data.meta.risk_view === "raw";
  const exposureChartData = rawIngestionView
    ? data.exposure_by_company.map((item) => ({ ...item, exposure: item.event_count }))
    : data.exposure_by_company;
  const heatmapData = rawIngestionView
    ? data.topic_heatmap.map((item) => ({ ...item, score: item.event_count }))
    : data.topic_heatmap;
  const primaryMetricLabel = rawIngestionView
    ? isSelected ? "Selected Signals" : "Most Signals"
    : isSelected ? "Selected" : "Highest Risk";
  const evidenceMetricLabel = isSelected ? "Selected Evidence" : "Evidence";
  const riskMetricLabel = rawIngestionView
    ? isSelected ? "Selected Count" : "Avg Score"
    : isSelected ? "Selected Risk" : "Avg Risk";
  const riskMetricValue = isSelected ? sel?.exposure ?? 0 : d.averageExposure;

  return (
    <main className="min-h-screen">
      <section className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary"><Activity className="h-4 w-4" /> SignalLens</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Public Company Risk Intelligence</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {REAL_INGESTION_MODE
                ? "Evidence to explanation to action for public company risk signals from live RSS and SEC ingestion."
                : "Evidence to explanation to action for public company risk signals. This local MVP uses seeded mock events only."}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Metric label={primaryMetricLabel} value={sel?.ticker ?? "None"} />
            <Metric label={evidenceMetricLabel} value={d.eventCount.toString()} />
            <Metric label={riskMetricLabel} value={riskMetricValue.toString()} />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-5 px-6 py-6">
        <div className={`flex flex-col gap-3 rounded-md border border-dashed px-4 py-3 text-sm md:flex-row md:items-center md:justify-between ${REAL_INGESTION_MODE ? "border-sky-300 bg-sky-50 text-sky-950" : "border-amber-300 bg-amber-50 text-amber-950"}`}>
          <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{REAL_INGESTION_MODE ? rawIngestionView ? "Real ingestion mode. Mock seed events are hidden; visible rows are awaiting extraction/scoring." : `Real ingestion mode. Mock seed events are hidden; risk panels use ${data.meta.scored_event_count} extracted/scored events${data.meta.pending_event_count ? `, with ${data.meta.pending_event_count} still pending` : ""}.${isSelected && sel ? ` Viewing ${sel.ticker} details.` : ""}` : "Seeded mock risk terminal. Source links, excerpts, scores, and AI-style summaries are synthetic placeholders for product development."}</span></div>
          {selectedCompany ? <button className="inline-flex items-center gap-2 self-start rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-950" onClick={clear} type="button"><X className="h-3.5 w-3.5" /> Clear selection</button> : null}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_1.05fr]">
          <Card className="self-start">
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Decision Snapshot</CardTitle><ShieldAlert className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="grid gap-3 md:grid-cols-3"><Tile label="Company" value={sel?.company ?? "None"} /><Tile label="Top Topic" value={d.topIncreasingTopic} /><Tile label="Action" value={d.topDrivers[0]?.suggested_action || (rawIngestionView ? "Run extraction/scoring" : "Select a company")} /></div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle>{rawIngestionView ? "Ingestion Snapshot" : isSelected ? `${sel?.ticker} Risk Drivers` : "Risk Drivers"}</CardTitle><Brain className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-700">{rawIngestionView || selectedCompany ? d.riskSummary : data.ai_summary.body}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <Stat label={rawIngestionView ? "Most visible signals" : isSelected ? "Selected company" : "Highest-risk company"} value={sel?.company ?? "None"} /><Stat label={rawIngestionView ? "Most visible topic" : "Increasing topic"} value={d.topIncreasingTopic} /><Stat label={isSelected ? "Selected evidence" : "Evidence count"} value={d.evidenceCount.toString()} /><Stat label="Avg confidence" value={`${Math.round(d.averageConfidence * 100)}%`} />
              </div>
              <div className="mt-4 space-y-3">
                {d.topDrivers.map((ev) => (
                  <button className="w-full rounded-md border border-border bg-slate-50 p-3 text-left hover:border-primary" key={ev.id} onClick={() => pick(ev.company, ev.ticker)} type="button">
                    <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{ev.topic}</span><Badge variant={ev.severity}>{ev.severity}</Badge></div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{ev.risk_driver_summary || ev.title}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>{rawIngestionView ? "Ingested Events by Company" : "Risk Exposure by Company"}</CardTitle>{isSelected ? <p className="mt-1 text-xs text-muted-foreground">Portfolio context; selected company is highlighted.</p> : null}</div><Building2 className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent className="h-80">
              <ExposureChart data={exposureChartData} selectedCompany={selectedCompany} onSelect={(key) => { const idx = key.indexOf(":"); pick(key.slice(0, idx), key.slice(idx + 1)); }} />
            </CardContent>
          </Card>
          <ScoringMethodologyCard realIngestionMode={REAL_INGESTION_MODE} pendingMode={rawIngestionView} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>{rawIngestionView ? "Scoring Status" : selectedCompany ? `${sel?.ticker} Risk Trend` : "Company Risk Trend"}</CardTitle>{isSelected ? <p className="mt-1 text-xs text-muted-foreground">Selected company detail.</p> : null}</div><Globe2 className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent>
              {rawIngestionView ? (
                <div className="flex h-72 flex-col justify-center gap-4 text-sm text-slate-700">
                  <p>Risk trend is unavailable until extraction assigns non-zero risk scores.</p>
                  <div className="rounded-md border border-border bg-slate-50 p-4">
                    <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Current queue</div>
                    <div className="mt-2 text-2xl font-semibold">{d.eventCount}</div>
                    <p className="mt-1 text-xs text-muted-foreground">visible ingested events pending extraction/scoring</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-3 text-sm text-muted-foreground">{d.trendSummary}</div>
                  <div className="h-72"><TrendChart data={d.trendByDate} selectedCompany={selectedCompany} /></div>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle>{rawIngestionView ? "Ingested Topic Counts" : "Risk Topic Heatmap"}</CardTitle><Database className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent>
              {rawIngestionView ? (
                <div className="mb-3 text-xs leading-5 text-muted-foreground">Topics are fallback classifications until extraction runs. Counts show ingested event volume by current topic label.</div>
              ) : (
                <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {Object.entries(TOPIC_MAP).map(([label, short]) => <span key={label} title={label}>{short} = {label}</span>)}
                </div>
              )}
              <TopicHeatmap data={heatmapData} companies={data.exposure_by_company.map((e) => e.company)} selectedCompany={sel?.company ?? null}
                onCellClick={(company) => { const e = data.exposure_by_company.find((x) => x.company === company); if (e) pick(e.company, e.ticker); }} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle>{selectedCompany ? `Latest Risk Events: ${sel?.ticker}` : "Latest Risk Events"}</CardTitle><ListFilter className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent>
            <EventsTable events={paged} page={page} pageSize={PAGE_SIZE} total={d.visibleEvents.length} onPageChange={setPage} onEventClick={(ev) => pick(ev.company, ev.ticker)} scorePendingMode={rawIngestionView} />
          </CardContent>
        </Card>
      </div>

      {drawerOpen && sel ? (
        <CompanyDrawer company={sel.company} events={d.selectedEvents} onClose={() => setDrawerOpen(false)} exposure={sel.exposure} riskSummary={d.riskSummary} ticker={sel.ticker} topicScores={d.topicScores} trendSummary={d.trendSummary} averageConfidence={d.averageConfidence} />
      ) : null}
    </main>
  );
}
