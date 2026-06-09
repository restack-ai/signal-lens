"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  Building2,
  Database,
  Globe2,
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
import { type DashboardData, getDashboard } from "@/lib/api";

const topics = [
  "Regulation",
  "Litigation",
  "Cybersecurity",
  "Labor",
  "Supply Chain",
  "Climate",
  "Accounting",
  "Product Safety",
  "Management",
  "Geopolitics",
];

function heatColor(score: number) {
  if (score >= 78) return "bg-red-500 text-white";
  if (score >= 66) return "bg-orange-400 text-white";
  if (score >= 54) return "bg-amber-300 text-slate-950";
  if (score > 0) return "bg-teal-100 text-teal-950";
  return "bg-slate-100 text-slate-400";
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  const derived = useMemo(() => {
    if (!data) return null;

    const topExposure = data.exposure_by_company[0];
    const eventCount = data.latest_events.length;
    const averageExposure = Math.round(
      data.exposure_by_company.reduce((sum, item) => sum + item.exposure, 0) /
        Math.max(data.exposure_by_company.length, 1),
    );
    const heatmapLookup = new Map(
      data.topic_heatmap.map((cell) => [`${cell.company}:${cell.topic}`, cell]),
    );
    const trendByDate = Array.from(
      data.trend.reduce((map, point) => {
        const existing = map.get(point.date) ?? { date: point.date, score: 0, count: 0 };
        existing.score += point.score;
        existing.count += 1;
        map.set(point.date, existing);
        return map;
      }, new Map<string, { date: string; score: number; count: number }>()),
    )
      .map(([, item]) => ({
        date: item.date.slice(5),
        score: Math.round(item.score / item.count),
      }))
      .slice(-12);

    return { averageExposure, eventCount, heatmapLookup, topExposure, trendByDate };
  }, [data]);

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
            Fetching seeded risk intelligence.
          </CardContent>
        </Card>
      </main>
    );
  }

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
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              AI-assisted monitoring for public risk signals across global companies, seeded with mock web, RSS, and SEC-style events.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-border bg-slate-50 p-3">
              <div className="text-muted-foreground">Companies</div>
              <div className="mt-1 text-xl font-semibold">{data.exposure_by_company.length}</div>
            </div>
            <div className="rounded-lg border border-border bg-slate-50 p-3">
              <div className="text-muted-foreground">Events</div>
              <div className="mt-1 text-xl font-semibold">{derived.eventCount}</div>
            </div>
            <div className="rounded-lg border border-border bg-slate-50 p-3">
              <div className="text-muted-foreground">Avg Risk</div>
              <div className="mt-1 text-xl font-semibold">{derived.averageExposure}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-5 px-6 py-6">
        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Risk Exposure by Company</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.exposure_by_company} margin={{ left: -18, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="ticker" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="exposure" radius={[6, 6, 0, 0]}>
                    {data.exposure_by_company.map((entry) => (
                      <Cell
                        key={entry.ticker}
                        fill={entry.exposure >= 75 ? "#dc2626" : entry.exposure >= 62 ? "#f97316" : "#0f766e"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{data.ai_summary.title}</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-700">{data.ai_summary.body}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-muted-foreground">Highest Exposure</div>
                  <div className="mt-1 font-semibold">{derived.topExposure?.company ?? "None"}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-muted-foreground">Generated</div>
                  <div className="mt-1 font-semibold">{data.ai_summary.generated_at}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Company Risk Trend</CardTitle>
              <Globe2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={derived.trendByDate} margin={{ left: -18, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#0f766e" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Risk Topic Heatmap</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="grid min-w-[720px] gap-1" style={{ gridTemplateColumns: "140px repeat(10, 42px)" }}>
                  <div className="text-xs font-medium text-muted-foreground">Company</div>
                  {topics.map((topic) => (
                    <div key={topic} className="truncate text-xs text-muted-foreground" title={topic}>
                      {topic.slice(0, 3)}
                    </div>
                  ))}
                  {data.exposure_by_company.map((company) => (
                    <Fragment key={company.company}>
                      <div className="truncate text-sm font-medium">{company.company}</div>
                      {topics.map((topic) => {
                        const cell = derived.heatmapLookup.get(`${company.company}:${topic}`);
                        return (
                          <div
                            key={`${company.company}-${topic}`}
                            title={`${company.company} ${topic}: ${cell?.score ?? 0}`}
                            className={`flex h-8 items-center justify-center rounded-sm text-xs font-semibold ${heatColor(cell?.score ?? 0)}`}
                          >
                            {cell?.score ?? "-"}
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Latest Risk Events</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Event</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.latest_events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{event.event_date}</TableCell>
                      <TableCell className="font-medium">{event.company}</TableCell>
                      <TableCell>{event.topic}</TableCell>
                      <TableCell>
                        <Badge variant={event.severity}>{event.severity}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{event.risk_score}</TableCell>
                      <TableCell className="min-w-[300px]">
                        <div className="font-medium">{event.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{event.summary}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
