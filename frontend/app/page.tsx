"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Telescope } from "lucide-react";

import { ErrorBanner } from "@/components/ui/error-banner";
import { Spinner } from "@/components/ui/spinner";
import { NavRail } from "@/components/shell/NavRail";
import { TopBar } from "@/components/shell/TopBar";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { CopilotRail } from "@/components/shell/CopilotRail";
import { OverviewLens } from "@/components/lenses/OverviewLens";
import { AssetLens } from "@/components/lenses/AssetLens";
import { FeedLens } from "@/components/lenses/FeedLens";
import { PlaceholderLens } from "@/components/lenses/PlaceholderLens";
import { type LensId } from "@/components/shell/lenses";
import { type DashboardData, getDashboard } from "@/lib/api";
import { companyKey, deriveDashboard } from "@/lib/derive";
import { useTheme } from "@/lib/theme";

const REAL_INGESTION_MODE = process.env.NEXT_PUBLIC_REAL_INGESTION_MODE === "true";
const DERIVE_OPTS = { realIngestionMode: REAL_INGESTION_MODE };

export default function Home() {
  const { theme, toggle } = useTheme();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [lens, setLens] = useState<LensId>("overview");
  const [paletteOpen, setPaletteOpen] = useState(false);

  function fetchData() {
    setLoading(true);
    setError(null);
    getDashboard()
      .then((dd) => { setData(dd); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }
  useEffect(() => {
    getDashboard()
      .then((dd) => { setData(dd); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  // ⌘K / Ctrl-K opens the command palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dGlobal = useMemo(() => (data ? deriveDashboard(data, null, DERIVE_OPTS) : null), [data]);
  const dSel = useMemo(
    () => (data && selectedCompany ? deriveDashboard(data, selectedCompany, DERIVE_OPTS) : null),
    [data, selectedCompany],
  );

  function selectAsset(company: string, ticker: string) {
    setSelectedCompany(companyKey(company, ticker));
    setLens("asset");
  }
  function selectInPlace(company: string, ticker: string) {
    setSelectedCompany(companyKey(company, ticker));
  }

  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <Spinner />
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {REAL_INGESTION_MODE ? "Fetching live risk signals…" : "Fetching seeded risk intelligence…"}
          </p>
        </div>
      </main>
    );
  if (error || !data || !dGlobal)
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <ErrorBanner message={error ?? "Unknown error."} onRetry={fetchData} />
        </div>
      </main>
    );

  const rawIngestionView = REAL_INGESTION_MODE && data.meta.risk_view === "raw";
  const onAssetLens = lens === "asset" && Boolean(dSel);
  const sel = onAssetLens && dSel ? dSel.selectedExposure : null;

  // Copilot scope (answers + citations come live from the /copilot endpoint).
  const contextLabel = sel ? sel.ticker : "Global";
  const copilotSuggestions = sel
    ? [
        `What changed for ${sel.ticker} recently?`,
        "Which events drove the score up?",
        "How does it compare to peers?",
      ]
    : ["What are today's top movers?", "Which risk topic is rising fastest?", "Summarize portfolio risk."];

  const eventById = new Map(
    [...data.latest_events, ...data.company_events].map((e) => [e.id, e]),
  );
  function onCite(id: number) {
    const ev = eventById.get(id);
    if (ev) selectAsset(ev.company, ev.ticker);
  }

  const bannerTone = REAL_INGESTION_MODE
    ? "border-sky-400/40 bg-sky-400/10 text-sky-700 dark:text-sky-200"
    : "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-200";
  const bannerText = REAL_INGESTION_MODE
    ? rawIngestionView
      ? "Real ingestion mode. Mock seed events are hidden; rows await extraction/scoring."
      : `Real ingestion mode. Risk panels use ${data.meta.scored_event_count} extracted/scored events${data.meta.pending_event_count ? `, ${data.meta.pending_event_count} pending` : ""}.`
    : "Seeded demo terminal. Source links, excerpts, scores, and AI summaries are synthetic placeholders.";

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar
        onOpenPalette={() => setPaletteOpen(true)}
        realIngestionMode={REAL_INGESTION_MODE}
        feedRate={data.latest_events.length}
      />
      <div className="flex flex-1 overflow-hidden">
        <NavRail active={lens} onChange={setLens} onOpenPalette={() => setPaletteOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1280px] space-y-3 p-4">
            <div className={`flex items-start gap-2 rounded-sm border px-4 py-2 text-sm ${bannerTone}`}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="leading-5">{bannerText}</span>
            </div>

            {lens === "overview" && (
              <OverviewLens
                data={data}
                d={dGlobal}
                theme={theme}
                onSelect={selectInPlace}
                onOpenAsset={selectAsset}
                rawIngestionView={rawIngestionView}
              />
            )}
            {lens === "feed" && (
              <FeedLens data={data} onSelect={selectAsset} rawIngestionView={rawIngestionView} />
            )}
            {lens === "asset" && dSel && (
              <AssetLens
                data={data}
                d={dSel}
                theme={theme}
                onSelect={selectAsset}
                rawIngestionView={rawIngestionView}
                realIngestionMode={REAL_INGESTION_MODE}
              />
            )}
            {lens === "investigations" && (
              <PlaceholderLens
                icon={Telescope}
                title="Agentic Investigations"
                phase="Phase 4"
                description="Spawn a Claude research run that gathers evidence across your corpus and live sources, builds a timeline, and returns a fully cited risk memo with recommended actions."
                capabilities={[
                  "Multi-step tool-use loop over the evidence corpus + retrieval",
                  "Structured memo with inline citations to source events",
                  "Event timeline and driver attribution",
                  "Runs in the background (Celery) with streaming progress",
                ]}
              />
            )}
            {lens === "alerts" && (
              <PlaceholderLens
                icon={Bell}
                title="Alerts & Watchlists"
                phase="Phase 4"
                description="Threshold and watchlist rules that turn rising signals into push and email digests. The backend already exposes an alert-rules API to build on."
                capabilities={[
                  "Per-asset / per-topic score thresholds",
                  "Watchlist digests and real-time breach notifications",
                  "Email + webhook delivery",
                  "Scoped to the assets you track",
                ]}
              />
            )}
          </div>
        </main>

        <div className="hidden xl:block">
          <CopilotRail
            key={contextLabel}
            contextLabel={contextLabel}
            ticker={sel ? sel.ticker : null}
            suggestions={copilotSuggestions}
            onCite={onCite}
          />
        </div>
      </div>

      <CommandPalette
        key={paletteOpen ? "palette-open" : "palette-closed"}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        assets={data.exposure_by_company}
        onSelectAsset={selectAsset}
        onLens={setLens}
        onToggleTheme={toggle}
      />
    </div>
  );
}
