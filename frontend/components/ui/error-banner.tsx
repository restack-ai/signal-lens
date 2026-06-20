import * as React from "react";

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      role="alert"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow mb-1 text-destructive/80">Feed error</div>
          <p className="leading-5 text-foreground/90">{message}</p>
        </div>
        {onRetry ? (
          <button
            className="shrink-0 rounded-sm border border-destructive/50 bg-destructive/10 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-destructive hover:bg-destructive/20"
            onClick={onRetry}
            type="button"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
