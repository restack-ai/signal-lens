"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpenCheck,
  Brain,
  Building2,
  Database,
  ExternalLink,
  Globe2,
  ListFilter,
  PanelRightOpen,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type DashboardData, type RiskEvent, getDashboard } from "@/lib/api";
import { cn } from "@/lib/utils";

const topics = [
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

const severityFill: Record<string, string> = {
  critical: "#dc2626",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#0f766e",
};

function heatColor(score: number) {
  if (score >= 78) return "bg-red-500 text-white";
  if (score >= 66) return "bg-orange-400 text-white";
  if (score >= 54) return "bg-amber-300 text-slate-950";
  if (score > 0) return "bg-teal-100 text-teal-950";
  return "bg-slate-100 text-slate-400";
}

function confidenceLabel(value: number) {
  if (value >= 0.86) return "high";
  if (value >= 0.78) return "medium-high";
  if (value >= 0.68) return "medium";
  return "low";
}

function sourceLabel(sourceType: string) {
  return sourceType === "CompanyReport" ? "Company report" : sourceType;
}

function companyKey(company: string, ticker: string) {
  return `${company}:${ticker}`;
}

function getChartPayload(state: unknown): { company?: string; ticker?: string } | null {
  if (!state || typeof state !== "object" || !("activePayload" in state)) return null;
  const activePayload = (state as { activePayload?: Array<{ payload?: { company?: string; ticker?: string } }> })
    .activePayload;
  return activePayload?.[0]?.payload ?? null;
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  const derived = useMemo(() => {
    if (!data) return null;

    const selectedExposure =
      data.exposure_by_company.find((item) => companyKey(item.company, item.ticker) === selectedCompany) ??
      data.exposure_by_company[0];
    const selectedKey = selectedExposure
      ? companyKey(selectedExposure.company, selectedExposure.ticker)
      : null;
    const selectedEvents = selectedExposure
      ? data.latest_events.filter((event) => event.ticker === selectedExposure.ticker)
      : [];
    const visibleEvents = selectedExposure && selectedCompany ? selectedEvents : data.latest_events;
    const eventCount = selectedCompany ? selectedEvents.length : data.latest_events.length;
    const evidenceCount = selectedEvents.length;
    const averageConfidence = evidenceCount
      ? selectedEvents.reduce((sum, event) => sum + event.confidence, 0) / evidenceCount
      : 0;
    const averageExposure = Math.round(
      data.exposure_by_company.reduce((sum, item) => sum + item.exposure, 0) /
        Math.max(data.exposure_by_company.length, 1),
    );
    const heatmapLookup = new Map(
      data.topic_heatmap.map((cell) => [`${cell.company}:${cell.topic}`, cell]),
    );
    const topicScores = topics
      .map((topic) => {
        const score = selectedExposure
          ? heatmapLookup.get(`${selectedExposure.company}:${topic.label}`)?.score ?? 0
          : Math.round(
              data.topic_heatmap
                .filter((cell) => cell.topic === topic.label)
                .reduce((sum, cell) => sum + cell.score, 0) /
                Math.max(data.topic_heatmap.filter((cell) => cell.topic === topic.label).length, 1),
            );
        return { topic: topic.label, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
    const topIncreasingTopic = topicScores[0]?.topic ?? "No topic";
    const topDrivers = [...selectedEvents]
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 3);
    const trendSource = selectedExposure
      ? data.trend.filter((point) => point.company === selectedExposure.company)
      : data.trend;
    const trendByDate = Array.from(
      trendSource.reduce((map, point) => {
        const existing = map.get(point.date) ?? { date: point.date, score: 0, count: 0, company: point.company };
        existing.score += point.score;
        existing.count += 1;
        map.set(point.date, existing);
        return map;
      }, new Map<string, { date: string; score: number; count: number; company: string }>()),
    )
      .map(([, item]) => ({
        date: item.date.slice(5),
        score: Math.round(item.score / item.count),
        company: item.company,
      }))
      .slice(-12);
    const firstTrend = trendByDate[0]?.score ?? selectedExposure?.exposure ?? 0;
    const lastTrend = trendByDate.at(-1)?.score ?? selectedExposure?.exposure ?? 0;
    const trendSummary =
      lastTrend > firstTrend
        ? `Up ${lastTrend - firstTrend} pts over the visible seeded window`
        : lastTrend < firstTrend
          ? `Down ${firstTrend - lastTrend} pts over the visible seeded window`
          : "Flat over the visible seeded window";
    const riskSummary = selectedExposure
      ? `${selectedExposure.company} risk exposure is ${selectedExposure.exposure}, led by ${topicScores
          .slice(0, 2)
          .map((item) => item.topic)
          .join(" and ") || "seeded public-risk signals"}. The strongest seeded event evidence is ${
          topDrivers[0]?.topic ?? "not available"
        }, with ${confidenceLabel(averageConfidence)} confidence across ${evidenceCount} events.`
      : data.ai_summary.body;

    return {
      averageConfidence,
      averageExposure,
      eventCount,
      evidenceCount,
      heatmapLookup,
      riskSummary,
      selectedEvents,
      selectedExposure,
      selectedKey,
      topDrivers,
      topIncreasingTopic,
      topicScores,
      trendByDate,
      trendSummary,
      visibleEvents,
    };
  }, [data, selectedCompany]);

  function selectCompany(company: string, ticker: string, openDrawer = true) {
    setSelectedCompany(companyKey(company, ticker));
    setDrawerOpen(openDrawer);
  }

  function clearSelection() {
    setSelectedCompany(null);
    setDrawerOpen(false);
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>SignalLens API unavailable</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      </main>
    );
  }

  if (!data || !derived) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Loading SignalLens</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Fetching seeded mock risk intelligence.
          </CardContent>
        </Card>
      </main>
    );
  }

  const selected = derived.selectedExposure;

  return (
    <main className="min-h-screen">
      <section className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Activity className="h-4 w-4" />
              SignalLens
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              Public Company Risk Intelligence
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Evidence to explanation to action for public company risk signals. This local MVP uses seeded mock events only.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Metric label="Highest Risk" value={selected?.ticker ?? "None"} />
            <Metric label="Evidence" value={derived.eventCount.toString()} />
            <Metric label="Avg Risk" value={derived.averageExposure.toString()} />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-5 px-6 py-6">
        <div className="flex flex-col gap-3 rounded-md border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Seeded mock risk terminal. Source links, excerpts, scores, and AI-style summaries are synthetic placeholders for product development.
            </span>
          </div>
          {selectedCompany ? (
            <button
              className="inline-flex items-center gap-2 self-start rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-950"
              onClick={clearSelection}
              type="button"
            >
              <X className="h-3.5 w-3.5" />
              Clear selection
            </button>
          ) : null}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_1.05fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Decision Snapshot</CardTitle>
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <DecisionTile label="Company" value={selected?.company ?? "None"} />
                <DecisionTile label="Top Topic" value={derived.topIncreasingTopic} />
                <DecisionTile label="Action" value={derived.topDrivers[0]?.suggested_action ?? "Select a company"} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Risk Drivers</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-700">{selectedCompany ? derived.riskSummary : data.ai_summary.body}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <DriverStat label="Highest-risk company" value={selected?.company ?? "None"} />
                <DriverStat label="Increasing topic" value={derived.topIncreasingTopic} />
                <DriverStat label="Evidence count" value={derived.evidenceCount.toString()} />
                <DriverStat label="Avg confidence" value={`${Math.round(derived.averageConfidence * 100)}%`} />
              </div>
              <div className="mt-4 space-y-3">
                {derived.topDrivers.map((event) => (
                  <button
                    className="w-full rounded-md border border-border bg-slate-50 p-3 text-left hover:border-primary"
                    key={event.id}
                    onClick={() => selectCompany(event.company, event.ticker)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{event.topic}</span>
                      <Badge variant={event.severity}>{event.severity}</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{event.risk_driver_summary}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Risk Exposure by Company</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.exposure_by_company}
                  margin={{ left: -18, right: 12 }}
                  onClick={(state) => {
                    const item = getChartPayload(state);
                    if (item?.company && item.ticker) selectCompany(item.company, item.ticker);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="ticker" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="exposure" radius={[6, 6, 0, 0]}>
                    {data.exposure_by_company.map((entry) => {
                      const isSelected = derived.selectedKey === companyKey(entry.company, entry.ticker);
                      return (
                        <Cell
                          key={entry.ticker}
                          cursor="pointer"
                          fill={isSelected ? "#0f172a" : entry.exposure >= 75 ? "#dc2626" : entry.exposure >= 62 ? "#f97316" : "#0f766e"}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Scoring Methodology</CardTitle>
              <BookOpenCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Method label="Exposure Score" body="Weighted risk signal score aggregated from recent seeded events." />
              <Method label="Severity" body="Event-level impact estimate based on topic, mock source, and language intensity." />
              <Method label="Confidence" body="Reliability estimate based on source type, repeated signals, and extraction quality." />
              <Method label="Risk Drivers" body="Highest-contributing topics and events behind the current exposure score." />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{selectedCompany ? `${selected?.ticker} Risk Trend` : "Company Risk Trend"}</CardTitle>
              <Globe2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="mb-3 text-sm text-muted-foreground">{derived.trendSummary}</div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={derived.trendByDate}
                    margin={{ left: -18, right: 12 }}
                    onClick={(state) => {
                      const item = getChartPayload(state);
                      if (item?.company && selected) selectCompany(selected.company, selected.ticker);
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="#0f766e" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Risk Topic Heatmap</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {topics.map((topic) => (
                  <span key={topic.label} title={topic.label}>
                    {topic.short} = {topic.label}
                  </span>
                ))}
              </div>
              <div className="overflow-x-auto">
                <div className="grid min-w-[760px] gap-1" style={{ gridTemplateColumns: "154px repeat(10, 46px)" }}>
                  <div className="text-xs font-medium text-muted-foreground">Company</div>
                  {topics.map((topic) => (
                    <div key={topic.label} className="truncate text-xs text-muted-foreground" title={topic.label}>
                      {topic.short}
                    </div>
                  ))}
                  {data.exposure_by_company.map((company) => {
                    const isSelected = derived.selectedKey === companyKey(company.company, company.ticker);
                    return (
                      <Fragment key={company.company}>
                        <button
                          className={cn(
                            "truncate rounded-sm px-1 text-left text-sm font-medium hover:bg-slate-100",
                            isSelected && "bg-slate-900 text-white hover:bg-slate-900",
                          )}
                          onClick={() => selectCompany(company.company, company.ticker)}
                          type="button"
                        >
                          {company.company}
                        </button>
                        {topics.map((topic) => {
                          const cell = derived.heatmapLookup.get(`${company.company}:${topic.label}`);
                          return (
                            <button
                              key={`${company.company}-${topic.label}`}
                              title={`${company.company} ${topic.label}: ${cell?.score ?? 0}`}
                              className={`flex h-8 items-center justify-center rounded-sm text-xs font-semibold ring-offset-2 hover:ring-2 hover:ring-primary ${heatColor(cell?.score ?? 0)}`}
                              onClick={() => selectCompany(company.company, company.ticker)}
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
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{selectedCompany ? `Latest Risk Events: ${selected?.ticker}` : "Latest Risk Events"}</CardTitle>
            <ListFilter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <EventsTable events={derived.visibleEvents} onSelect={selectCompany} />
          </CardContent>
        </Card>
      </div>

      {drawerOpen && selected ? (
        <CompanyDrawer
          averageConfidence={derived.averageConfidence}
          events={derived.selectedEvents}
          exposure={selected.exposure}
          onClose={() => setDrawerOpen(false)}
          riskSummary={derived.riskSummary}
          ticker={selected.ticker}
          title={selected.company}
          topicScores={derived.topicScores}
          trendSummary={derived.trendSummary}
        />
      ) : null}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-slate-50 p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-xl font-semibold">{value}</div>
    </div>
  );
}

function DecisionTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-slate-50 p-3">
      <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</div>
      <div className="mt-2 line-clamp-3 text-sm font-semibold leading-5">{value}</div>
    </div>
  );
}

function DriverStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-semibold">{value}</div>
    </div>
  );
}

function Method({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div className="font-semibold text-slate-900">{label}</div>
      <p className="mt-1 leading-5 text-muted-foreground">{body}</p>
    </div>
  );
}

function EventsTable({
  events,
  onSelect,
}: {
  events: RiskEvent[];
  onSelect: (company: string, ticker: string, openDrawer?: boolean) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Topic</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Evidence</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">{event.event_date}</TableCell>
              <TableCell>
                <button
                  className="font-medium text-slate-950 hover:text-primary"
                  onClick={() => onSelect(event.company, event.ticker)}
                  type="button"
                >
                  {event.company}
                </button>
                <div className="text-xs text-muted-foreground">{event.ticker}</div>
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
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{event.evidence_excerpt}</p>
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
              <TableCell className="text-right font-semibold" style={{ color: severityFill[event.severity] }}>
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
  );
}

function CompanyDrawer({
  averageConfidence,
  events,
  exposure,
  onClose,
  riskSummary,
  ticker,
  title,
  topicScores,
  trendSummary,
}: {
  averageConfidence: number;
  events: RiskEvent[];
  exposure: number;
  onClose: () => void;
  riskSummary: string;
  ticker: string;
  title: string;
  topicScores: { topic: string; score: number }[];
  trendSummary: string;
}) {
  const latestEvents = events.slice(0, 4);
  const questions = [
    "What changed in the last 30 days?",
    "Which events caused the risk score to increase?",
    "How does this company compare with peers?",
    `Show only ${topicScores[0]?.topic.toLowerCase() ?? "regulation"}-related events.`,
  ];

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l border-border bg-white shadow-xl">
      <div className="flex items-start justify-between border-b border-border p-5">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <PanelRightOpen className="h-4 w-4" />
            Company Detail
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h2>
          <p className="text-sm text-muted-foreground">{ticker}</p>
        </div>
        <button className="rounded-md p-2 hover:bg-slate-100" onClick={onClose} type="button">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="grid gap-5 overflow-y-auto p-5">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <DriverStat label="Exposure" value={exposure.toString()} />
          <DriverStat label="Evidence" value={events.length.toString()} />
          <DriverStat label="Confidence" value={`${Math.round(averageConfidence * 100)}%`} />
        </div>

        <section>
          <h3 className="text-sm font-semibold">AI-style company risk summary</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{riskSummary}</p>
        </section>

        <section>
          <h3 className="text-sm font-semibold">Top risk topics</h3>
          <div className="mt-3 grid gap-2">
            {topicScores.slice(0, 4).map((item) => (
              <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm" key={item.topic}>
                <span>{item.topic}</span>
                <span className="font-semibold">{item.score}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold">30-day trend summary</h3>
          <p className="mt-2 text-sm text-muted-foreground">{trendSummary}</p>
        </section>

        <section>
          <h3 className="text-sm font-semibold">Latest related events</h3>
          <div className="mt-3 grid gap-3">
            {latestEvents.map((event) => (
              <div className="rounded-md border border-border p-3" key={event.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{event.title}</span>
                  <Badge variant={event.severity}>{event.severity}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{event.summary}</p>
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
            {events.map((event) => (
              <div className="rounded-md bg-slate-50 p-3" key={event.id}>
                <div className="text-xs font-medium text-muted-foreground">
                  {sourceLabel(event.source_type)} · {event.source_name} · extracted {event.extracted_at.slice(0, 10)}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{event.evidence_excerpt}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold">Suggested follow-up questions</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {questions.map((question) => (
              <button className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:border-primary" key={question} type="button">
                {question}
              </button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
