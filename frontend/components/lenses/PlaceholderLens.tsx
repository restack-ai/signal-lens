import { type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function PlaceholderLens({
  icon: Icon,
  title,
  phase,
  description,
  capabilities,
}: {
  icon: LucideIcon;
  title: string;
  phase: string;
  description: string;
  capabilities: string[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-5 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-md border border-border bg-panel">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="max-w-lg space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <span className="rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
              {phase}
            </span>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <div className="grid w-full max-w-lg gap-2 text-left">
          {capabilities.map((c) => (
            <div
              key={c}
              className="flex items-start gap-2 rounded-sm border border-border bg-panel px-3 py-2 text-sm text-foreground/80"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              {c}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
