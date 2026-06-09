export type CompanyExposure = {
  company: string;
  ticker: string;
  exposure: number;
  event_count: number;
};

export type TopicHeatmapCell = {
  company: string;
  topic: string;
  score: number;
  event_count: number;
};

export type TrendPoint = {
  date: string;
  company: string;
  score: number;
};

export type RiskEvent = {
  id: number;
  title: string;
  company_id: number;
  company: string;
  ticker: string;
  topic: string;
  topic_label: string;
  source_type: "SEC" | "RSS" | "Web" | "GDELT" | "CompanyReport";
  source_name: string;
  source_url: string;
  extracted_at: string;
  event_date: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  risk_score: number;
  exposure_score: number;
  summary: string;
  evidence_excerpt: string;
  risk_driver_summary: string;
  suggested_action: string;
};

export type DashboardData = {
  exposure_by_company: CompanyExposure[];
  topic_heatmap: TopicHeatmapCell[];
  trend: TrendPoint[];
  latest_events: RiskEvent[];
  ai_summary: {
    title: string;
    body: string;
    generated_at: string;
  };
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function getDashboard(): Promise<DashboardData> {
  const response = await fetch(`${API_BASE_URL}/dashboard`, {
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    throw new Error(`SignalLens API returned ${response.status}`);
  }

  return response.json();
}
