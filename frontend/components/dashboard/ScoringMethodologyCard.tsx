import { BookOpenCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Method({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div className="font-semibold text-slate-900">{label}</div>
      <p className="mt-1 leading-5 text-muted-foreground">{body}</p>
    </div>
  );
}

export function ScoringMethodologyCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Scoring Methodology</CardTitle>
        <BookOpenCheck className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <Method
          label="Exposure Score"
          body="Weighted risk signal score aggregated from recent seeded events."
        />
        <Method
          label="Severity"
          body="Event-level impact estimate based on topic, mock source, and language intensity."
        />
        <Method
          label="Confidence"
          body="Reliability estimate based on source type, repeated signals, and extraction quality."
        />
        <Method
          label="Risk Drivers"
          body="Highest-contributing topics and events behind the current exposure score."
        />
      </CardContent>
    </Card>
  );
}
