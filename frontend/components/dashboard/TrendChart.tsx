"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TrendChartPoint = {
  date: string;
  score: number;
  company: string;
};

export function TrendChart({
  data,
  selectedCompany,
}: {
  data: TrendChartPoint[];
  selectedCompany: string | null;
}) {
  void selectedCompany; // available for future per-company coloring
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ left: -18, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#0f766e"
          strokeWidth={3}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
