"use client";

export function RiskDriversPanel({
  summary,
}: {
  summary: { title: string; body: string; generated_at: string };
}) {
  return (
    <div>
      <p className="text-sm leading-6 text-slate-700">{summary.body}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        Generated {summary.generated_at.slice(0, 10)}
      </p>
    </div>
  );
}
