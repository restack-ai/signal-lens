import * as React from "react";

import { cn } from "@/lib/utils";

const severityStyles: Record<string, string> = {
  low: "border-signal-low/40 bg-signal-low/10 text-signal-low",
  medium: "border-signal-medium/40 bg-signal-medium/10 text-signal-medium",
  high: "border-signal-high/40 bg-signal-high/10 text-signal-high",
  critical: "border-signal-critical/50 bg-signal-critical/15 text-signal-critical",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-[0.12em]",
        severityStyles[variant] ?? "border-border-strong bg-muted text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
