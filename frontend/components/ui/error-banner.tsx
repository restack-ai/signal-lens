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
      className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
      role="alert"
    >
      <div className="flex items-start justify-between gap-4">
        <p className="leading-5">{message}</p>
        {onRetry ? (
          <button
            className="shrink-0 rounded-md border border-red-400 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50"
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
