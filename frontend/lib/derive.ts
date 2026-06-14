import { type DashboardData } from "./api";

const TOPIC_LABELS = [
  "Regulation","Litigation","Cybersecurity","Labor","Supply Chain",
  "Climate","Accounting","Product Safety","Management","Geopolitics",
];

function confidenceLabel(v: number) {
  if (v >= 0.86) return "high";
  if (v >= 0.78) return "medium-high";
  if (v >= 0.68) return "medium";
  return "low";
}

export function companyKey(company: string, ticker: string) {
  return `${company}:${ticker}`;
}

export function deriveDashboard(data: DashboardData, selectedCompany: string | null) {
  const selectedExposure =
    data.exposure_by_company.find((e) => companyKey(e.company, e.ticker) === selectedCompany) ??
    data.exposure_by_company[0];
  const selectedKey = selectedExposure
    ? companyKey(selectedExposure.company, selectedExposure.ticker) : null;
  const selectedEvents = selectedExposure
    ? data.latest_events.filter((ev) => ev.ticker === selectedExposure.ticker) : [];
  const visibleEvents = selectedExposure && selectedCompany ? selectedEvents : data.latest_events;
  const eventCount = selectedCompany ? selectedEvents.length : data.latest_events.length;
  const evidenceCount = selectedEvents.length;
  const averageConfidence = evidenceCount
    ? selectedEvents.reduce((s, e) => s + e.confidence, 0) / evidenceCount : 0;
  const averageExposure = Math.round(
    data.exposure_by_company.reduce((s, e) => s + e.exposure, 0) /
      Math.max(data.exposure_by_company.length, 1),
  );
  const heatmapLookup = new Map(
    data.topic_heatmap.map((c) => [`${c.company}:${c.topic}`, c]),
  );
  const topicScores = TOPIC_LABELS.map((topic) => {
    const score = selectedExposure
      ? heatmapLookup.get(`${selectedExposure.company}:${topic}`)?.score ?? 0
      : Math.round(
          data.topic_heatmap.filter((c) => c.topic === topic).reduce((s, c) => s + c.score, 0) /
            Math.max(data.topic_heatmap.filter((c) => c.topic === topic).length, 1),
        );
    return { topic, score };
  }).filter((i) => i.score > 0).sort((a, b) => b.score - a.score);
  const topIncreasingTopic = topicScores[0]?.topic ?? "No topic";
  const topDrivers = [...selectedEvents].sort((a, b) => b.risk_score - a.risk_score).slice(0, 3);
  const trendSource = selectedExposure
    ? data.trend.filter((p) => p.company === selectedExposure.company) : data.trend;
  const trendByDate = Array.from(
    trendSource.reduce((map, p) => {
      const ex = map.get(p.date) ?? { date: p.date, score: 0, count: 0, company: p.company };
      ex.score += p.score; ex.count += 1; map.set(p.date, ex); return map;
    }, new Map<string, { date: string; score: number; count: number; company: string }>()),
  ).map(([, i]) => ({
    date: i.date.slice(5), score: Math.round(i.score / i.count), company: i.company,
  })).slice(-12);
  const firstTrend = trendByDate[0]?.score ?? selectedExposure?.exposure ?? 0;
  const lastTrend = trendByDate.at(-1)?.score ?? selectedExposure?.exposure ?? 0;
  const trendSummary =
    lastTrend > firstTrend
      ? `Up ${lastTrend - firstTrend} pts over the visible seeded window`
      : lastTrend < firstTrend
        ? `Down ${firstTrend - lastTrend} pts over the visible seeded window`
        : "Flat over the visible seeded window";
  const riskSummary = selectedExposure
    ? `${selectedExposure.company} risk exposure is ${selectedExposure.exposure}, led by ${
        topicScores.slice(0, 2).map((i) => i.topic).join(" and ") || "seeded public-risk signals"
      }. The strongest seeded event evidence is ${topDrivers[0]?.topic ?? "not available"}, with ${
        confidenceLabel(averageConfidence)
      } confidence across ${evidenceCount} events.`
    : data.ai_summary.body;
  return {
    averageConfidence, averageExposure, eventCount, evidenceCount,
    riskSummary, selectedEvents, selectedExposure, selectedKey,
    topDrivers, topIncreasingTopic, topicScores, trendByDate, trendSummary, visibleEvents,
  };
}
