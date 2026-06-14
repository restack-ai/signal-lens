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

export function deriveDashboard(
  data: DashboardData,
  selectedCompany: string | null,
  options: { realIngestionMode?: boolean } = {},
) {
  const windowLabel = options.realIngestionMode ? "visible ingestion window" : "visible seeded window";
  const fallbackSignalLabel = options.realIngestionMode
    ? "ingested public-source signals"
    : "seeded public-risk signals";
  const strongestEvidenceLabel = options.realIngestionMode
    ? "strongest ingested signal"
    : "strongest seeded event evidence";
  const selectedExposure =
    data.exposure_by_company.find((e) => companyKey(e.company, e.ticker) === selectedCompany) ??
    data.exposure_by_company[0];
  const selectedKey = selectedExposure
    ? companyKey(selectedExposure.company, selectedExposure.ticker) : null;
  const companyScopedEvents = selectedExposure
    ? data.company_events.filter((ev) => ev.ticker === selectedExposure.ticker) : [];
  const latestSelectedEvents = selectedExposure
    ? data.latest_events.filter((ev) => ev.ticker === selectedExposure.ticker) : [];
  const selectedEvents = companyScopedEvents.length ? companyScopedEvents : latestSelectedEvents;
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
    const cell = selectedExposure ? heatmapLookup.get(`${selectedExposure.company}:${topic}`) : null;
    const topicCells = data.topic_heatmap.filter((c) => c.topic === topic);
    const score = selectedExposure
      ? cell?.score ?? 0
      : Math.round(topicCells.reduce((s, c) => s + c.score, 0) / Math.max(topicCells.length, 1));
    const eventCount = selectedExposure
      ? cell?.event_count ?? 0
      : topicCells.reduce((s, c) => s + c.event_count, 0);
    return { topic, score, eventCount };
  }).filter((i) => i.score > 0 || (options.realIngestionMode && i.eventCount > 0))
    .sort((a, b) => b.score - a.score || b.eventCount - a.eventCount);
  const topIncreasingTopic = topicScores[0]?.topic ?? "No topic";
  const topDrivers = [...selectedEvents].sort((a, b) => b.risk_score - a.risk_score).slice(0, 3);
  const isAwaitingExtraction =
    Boolean(options.realIngestionMode && selectedExposure && selectedExposure.exposure === 0 && evidenceCount > 0);
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
    trendByDate.length < 3
      ? `Limited trend history across ${trendByDate.length} visible dates`
      : lastTrend > firstTrend
      ? `Up ${lastTrend - firstTrend} pts over the ${windowLabel}`
      : lastTrend < firstTrend
        ? `Down ${firstTrend - lastTrend} pts over the ${windowLabel}`
        : `Flat over the ${windowLabel}`;
  const riskSummary = selectedExposure
    ? isAwaitingExtraction
      ? `${selectedExposure.company} has ${evidenceCount} visible ingested public-source ${
          evidenceCount === 1 ? "event" : "events"
        } awaiting extraction and scoring. Most visible topic is ${
          topIncreasingTopic
        }; risk score remains 0 until extraction runs.`
      : evidenceCount <= 2 || averageConfidence < 0.6
        ? `Limited evidence indicates ${selectedExposure.company} has monitoring signals around ${
          topicScores.slice(0, 2).map((i) => i.topic).join(" and ") || fallbackSignalLabel
        }. Treat the current exposure score of ${selectedExposure.exposure} as provisional because it is based on ${
          evidenceCount
        } ${evidenceCount === 1 ? "event" : "events"} with ${confidenceLabel(averageConfidence)} confidence.`
        : `${selectedExposure.company} risk exposure is ${selectedExposure.exposure}, led by ${
          topicScores.slice(0, 2).map((i) => i.topic).join(" and ") || fallbackSignalLabel
        }. The ${strongestEvidenceLabel} is ${topDrivers[0]?.topic ?? "not available"}, with ${
          confidenceLabel(averageConfidence)
        } confidence across ${evidenceCount} events.`
    : data.ai_summary.body;
  return {
    averageConfidence, averageExposure, eventCount, evidenceCount,
    riskSummary, selectedEvents, selectedExposure, selectedKey,
    isAwaitingExtraction,
    topDrivers, topIncreasingTopic, topicScores, trendByDate, trendSummary, visibleEvents,
  };
}
