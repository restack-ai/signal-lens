"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { type Theme } from "@/lib/theme";

export type TrendChartPoint = {
  date: string;
  score: number;
  company: string;
};

const CHART_THEME = {
  light: { grid: "#e2e8f0", tip: "#ffffff", tipBorder: "#e2e8f0", line: "#0d9488", text: "#0f172a" },
  dark: { grid: "#1c2536", tip: "#0a0f1a", tipBorder: "#1f2a3c", line: "#2dd4bf", text: "#e2e8f0" },
};

const AXIS_TICK = { fill: "#64748b", fontSize: 11, fontFamily: "var(--font-mono)" };

export function TrendChart({
  data,
  selectedCompany,
  theme = "light",
}: {
  data: TrendChartPoint[];
  selectedCompany: string | null;
  theme?: Theme;
}) {
  void selectedCompany; // available for future per-company coloring
  const c = CHART_THEME[theme];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: -18, right: 12, top: 6 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.line} stopOpacity={0.32} />
            <stop offset="100%" stopColor={c.line} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke={c.grid} vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={28} />
        <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} width={36} />
        <Tooltip
          cursor={{ stroke: c.line, strokeWidth: 1, strokeDasharray: "3 3" }}
          contentStyle={{
            background: c.tip,
            border: `1px solid ${c.tipBorder}`,
            borderRadius: 4,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
          labelStyle={{ color: "#94a3b8" }}
          itemStyle={{ color: c.text }}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke={c.line}
          strokeWidth={2}
          fill="url(#trendFill)"
          dot={false}
          activeDot={{ r: 3, fill: c.line, stroke: c.tip, strokeWidth: 1 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
