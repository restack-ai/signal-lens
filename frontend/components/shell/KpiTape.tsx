import { cn } from "@/lib/utils";

export type KpiItem = {
  label: string;
  value: string;
  tone?: "default" | "critical" | "high" | "medium" | "low" | "primary";
};

const toneClass: Record<NonNullable<KpiItem["tone"]>, string> = {
  default: "text-foreground",
  primary: "text-primary",
  critical: "text-signal-critical",
  high: "text-signal-high",
  medium: "text-signal-medium",
  low: "text-signal-low",
};

export function KpiTape({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-2 divide-border overflow-hidden rounded-md border border-border bg-card shadow-panel sm:grid-cols-3 sm:divide-x lg:grid-cols-6">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            "px-4 py-3",
            i % 2 === 1 && "border-l border-border sm:border-l-0",
            i >= 2 && "border-t border-border sm:border-t-0",
            i >= 3 && "lg:border-t-0",
          )}
        >
          <div className="eyebrow truncate">{item.label}</div>
          <div
            className={cn(
              "mt-1 truncate font-mono text-xl font-bold tabular-nums",
              toneClass[item.tone ?? "default"],
            )}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
