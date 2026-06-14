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

function companyKey(company: string, ticker: string) {
  return `${company}:${ticker}`;
}

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
}: {
  data: CompanyExposure[];
  selectedCompany: string | null;
  onSelect: (company: string) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ left: -18, right: 12 }}
        onClick={(state) => {
          const item = getChartPayload(state);
          if (item?.company && item.ticker) {
            onSelect(companyKey(item.company, item.ticker));
          }
        }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="ticker" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <Tooltip />
        <Bar dataKey="exposure" radius={[6, 6, 0, 0]}>
          {data.map((entry) => {
            const isSelected =
              selectedCompany === companyKey(entry.company, entry.ticker);
            return (
              <Cell
                key={entry.ticker}
                cursor="pointer"
                fill={
                  isSelected
                    ? "#0f172a"
                    : entry.exposure >= 75
                      ? "#dc2626"
                      : entry.exposure >= 62
                        ? "#f97316"
                        : "#0f766e"
                }
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
