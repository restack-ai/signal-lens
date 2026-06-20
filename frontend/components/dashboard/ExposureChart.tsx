"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { type CompanyExposure } from "@/lib/api";
import { type Theme } from "@/lib/theme";

function companyKey(company: string, ticker: string) {
  return `${company}:${ticker}`;
}

// Signal palette for the bars (works on both surfaces).
const CRITICAL = "#f04438";
const HIGH = "#fb923c";
const NOMINAL = "#14b8a6";
const ACCENT = "#f59e0b"; // selection outline

function barColor(exposure: number) {
  if (exposure >= 75) return CRITICAL;
  if (exposure >= 62) return HIGH;
  return NOMINAL;
}

const CHART_THEME = {
  light: { grid: "#e2e8f0", tip: "#ffffff", tipBorder: "#e2e8f0", cursor: "rgba(20,184,166,0.08)" },
  dark: { grid: "#1c2536", tip: "#0a0f1a", tipBorder: "#1f2a3c", cursor: "rgba(94,234,212,0.06)" },
};

const AXIS_TICK = { fill: "#64748b", fontSize: 11, fontFamily: "var(--font-mono)" };

function getChartPayload(
  state: unknown,
): { company?: string; ticker?: string } | null {
  if (!state || typeof state !== "object" || !("activePayload" in state))
    return null;
  const activePayload = (
    state as {
      activePayload?: Array<{
        payload?: { company?: string; ticker?: string };
      }>;
    }
  ).activePayload;
  return activePayload?.[0]?.payload ?? null;
}

export function ExposureChart({
  data,
  selectedCompany,
  onSelect,
  theme = "light",
}: {
  data: CompanyExposure[];
  selectedCompany: string | null;
  onSelect: (company: string) => void;
  theme?: Theme;
}) {
  const c = CHART_THEME[theme];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ left: -18, right: 12, top: 6 }}
        onClick={(state) => {
          const item = getChartPayload(state);
          if (item?.company && item.ticker) {
            onSelect(companyKey(item.company, item.ticker));
          }
        }}
      >
        <CartesianGrid strokeDasharray="2 4" stroke={c.grid} vertical={false} />
        <XAxis dataKey="ticker" tickLine={false} axisLine={false} tick={AXIS_TICK} />
        <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} width={36} />
        <Tooltip
          cursor={{ fill: c.cursor }}
          contentStyle={{
            background: c.tip,
            border: `1px solid ${c.tipBorder}`,
            borderRadius: 4,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
          labelStyle={{ color: "#94a3b8" }}
          itemStyle={{ color: theme === "dark" ? "#e2e8f0" : "#0f172a" }}
        />
        <Bar dataKey="exposure" radius={[2, 2, 0, 0]} maxBarSize={34}>
          {data.map((entry) => {
            const isSelected =
              selectedCompany === companyKey(entry.company, entry.ticker);
            return (
              <Cell
                key={entry.ticker}
                cursor="pointer"
                fill={barColor(entry.exposure)}
                // Selection reads as a bright amber outline rather than a hue
                // swap, so it stands out regardless of the bar's signal color.
                stroke={isSelected ? ACCENT : "transparent"}
                strokeWidth={isSelected ? 2 : 0}
                fillOpacity={isSelected || !selectedCompany ? 1 : 0.4}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
