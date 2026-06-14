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

export function ScoringMethodologyCard({
  realIngestionMode = false,
  pendingMode = false,
}: {
  realIngestionMode?: boolean;
  pendingMode?: boolean;
}) {
  if (pendingMode) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Extraction Status</CardTitle>
          <BookOpenCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Method
            label="Current State"
            body="Events have been ingested from live RSS and SEC sources and are waiting for extraction."
          />
          <Method
            label="Pending Step"
            body="Run the extraction worker with an Anthropic API key to classify topics, assign severity, generate evidence excerpts, and score risk."
          />
          <Method
            label="Visible Counts"
            body="Charts in this mode show ingested event volume, not risk exposure."
          />
          <Method
            label="Scores"
            body="Raw events intentionally show Pending instead of a numeric score."
          />
        </CardContent>
      </Card>
    );
  }

  const exposureBody = realIngestionMode
    ? "Average risk signal score from extracted/scored public-source events. Raw pending events are excluded until extraction completes."
    : "Average risk signal score aggregated from recent seeded events.";
  const severityBody = realIngestionMode
    ? "Event-level impact estimate produced by extraction from public-source evidence."
    : "Event-level impact estimate based on topic, source, and language intensity.";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Scoring Methodology</CardTitle>
        <BookOpenCheck className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <Method
          label="Exposure Score"
          body={exposureBody}
        />
        <Method
          label="Severity"
          body={severityBody}
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
