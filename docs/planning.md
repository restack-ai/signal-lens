# SignalLens — Path to Production

This document plans the move from the current **mock-data MVP** to a **production-grade** risk intelligence platform. It is grounded in the existing code (`backend/app/`, `frontend/`, `docker-compose.yml`) and the roadmap in `README.md`.

## Where we are today (honest baseline)

- **No real data.** Everything is synthetic, generated in `backend/app/seed.py`. URLs, excerpts, scores, and the "AI summary" are placeholders.
- **The "AI summary" is string interpolation** in `main.py` `/dashboard`, not an LLM.
- **`RiskEvent.embedding` is a `Text` placeholder**, not a real vector.
- **Seeding is destructive** — `drop_all`/`create_all` on every backend start. No migrations, no persisted state.
- **No auth, no tests, no CI, no observability.**
- **Read-only API**: `/health`, `/companies`, `/topics`, `/events`, `/dashboard`.
- **Dashboard UI is one 725-line file** (`frontend/app/page.tsx`) with local React state.

The data model is intentionally forward-looking (source types `SEC | RSS | Web | GDELT | CompanyReport`, confidence/severity/exposure fields). The job is to make those fields *real* without rewriting the contract.

---

## Guiding principles

1. **Keep the three-file contract intact** (`models.py` ↔ `schemas.py` ↔ `frontend/lib/api.ts`). Evolve it deliberately; never let them drift.
2. **Every score must be traceable to evidence.** Production credibility depends on citations, not vibes. No score without a source row behind it.
3. **Ingestion and serving are separate concerns.** The read API should never block on crawling or LLM calls.
4. **Ship incrementally behind flags.** Each phase should be deployable and reversible.

---

## Phase 0 — Production foundations (do this first)

These are prerequisites that the README roadmap omits but production requires.

### Migrations
- Replace `drop_all`/`create_all` + reseed with **Alembic** migrations.
- Make seeding idempotent and opt-in (`SEED_ON_START=false` by default in non-dev). Today's destructive reseed must never run against a real database.
- First migration = current schema; thereafter every model change ships a migration.

### Config & secrets
- Split config into environments (dev/staging/prod). Move secrets out of `docker-compose.yml` (DB password is currently hardcoded `signallens/signallens`).
- Use a secrets manager (Vault / cloud SM); inject via env at deploy.

### Testing & CI
- Backend: `pytest` + `httpx` for API tests, a Postgres test container, factory fixtures replacing hand-seeded rows.
- Frontend: component tests (Vitest + Testing Library) and typed API mocks.
- **Contract test** that asserts `schemas.py` response shapes match `frontend/lib/api.ts` types (codegen or schema snapshot) so the contract can't silently drift.
- GitHub Actions: lint → typecheck → test → build → image push on every PR.

### Observability
- Structured logging (JSON), request IDs, OpenTelemetry traces.
- Error tracking (Sentry) on both tiers.
- Metrics: API latency, ingestion lag, extraction failure rate, score distribution drift.

### Security baseline
- AuthN/Z (see Phase 4) — but at minimum, lock CORS to known origins, add rate limiting, input validation on `limit` params, and dependency scanning.

**Exit criteria:** schema is migration-managed, CI is green and gating, prod config has no hardcoded secrets, basic dashboards exist.

---

## Phase 1 — Real ingestion pipeline (README Phase 2)

Goal: replace seeded `RiskEvent` rows with real, deduplicated events from real sources.

### Architecture
- Introduce a **worker tier** separate from the FastAPI read API (Celery/RQ/Arq + Redis, or a managed queue). The README's Phase 4 mentions Restack-style orchestration — adopt a durable workflow engine here for retries/scheduling.
- Pipeline stages: **fetch → parse → entity match → dedupe → persist (status=`raw`)**.

### Sources (in priority order)
1. **SEC EDGAR** — structured, authoritative, free. Best first source.
2. **RSS** — company/news feeds, high volume.
3. **Web / GDELT** — broader but noisier; add later with stricter confidence discounting.

### Entity matching
- Map raw mentions → `Company` rows. Start with ticker/name dictionary + alias table; graduate to fuzzy matching. Persist match confidence.

### Deduplication
- Hash + near-duplicate detection (minhash/embeddings) so the same event from multiple feeds collapses to one `RiskEvent` with multiple sources.
- This requires promoting "source" to its own table (one event ↔ many sources), a contract change — plan the migration.

### Data model changes
- Add ingestion status (`raw | extracted | scored | published`), `fetched_at`, raw payload storage (object store, not Postgres `Text`).
- Replace `ingestion_source="mock_seed"` semantics with real provenance.

**Exit criteria:** dashboard renders from at least SEC + RSS real data; mock seed is dev-only; dedupe + entity match measured for precision.

---

## Phase 2 — Structured risk extraction & real AI summaries (README Phase 3)

Goal: turn raw documents into structured, **citation-backed** risk events and summaries using a real LLM.

### Extraction
- Use **Claude (Opus 4.8 for quality-critical extraction, Sonnet/Haiku for high-volume)** with structured outputs / tool use to extract: topic classification, severity, confidence, evidence excerpt, suggested action — the exact fields `RiskEvent` already defines.
- Every extracted field must cite the source span it came from (store char offsets / excerpt). No uncited claims reach the UI.
- Prompt-cache the system prompt + taxonomy; batch where latency allows.

### Embeddings (make pgvector real)
- Replace `RiskEvent.embedding: Text` with a real `Vector` column via migration; enable on the existing `pgvector` extension (already in `db/init/001_pgvector.sql`).
- Use embeddings for dedupe, semantic search over evidence, and "related events" in the detail drawer.

### AI summaries (replace the string template)
- Replace the interpolated `ai_summary` in `main.py` with an LLM-generated, citation-backed summary per company.
- Generate **offline** in the worker tier, persist to `CompanySummary` (table already exists), serve precomputed. The read API must not call the LLM inline.
- Store `model_name`, prompt version, and source citations for auditability.

### Evaluation
- Build a **labeled eval set** (README Phase 3): gold topic/severity/confidence on a sample of documents.
- Track extraction precision/recall and summary faithfulness (citation-grounded) in CI; gate model/prompt changes on it.
- Guardrails: refusal handling, hallucination checks (every claim must map to a citation), cost ceilings per run.

**Exit criteria:** scores and summaries are LLM-derived and fully cited; eval set gates regressions; pgvector powers semantic search.

---

## Phase 3 — Analytics & alerting (README Phase 4)

Goal: scale analytics and make the product proactive.

- **Analytics layer**: ClickHouse + dbt for trend/aggregation queries that are currently ad-hoc SQL in `/dashboard`. Move heavy aggregations off the OLTP Postgres.
- **DuckDB** for local/ad-hoc analyst exploration.
- **Feature store (Feast)** if scoring models need shared features.
- **Alerting**: threshold + anomaly detection on exposure/trend; notify on new high-severity cited events. Scheduled report generation per watchlist.
- Backfill historical trend data so the 60-day trend window in `/dashboard` reflects real history.

**Exit criteria:** dashboard queries served from the analytics layer; analysts receive alerts on material risk changes.

---

## Phase 4 — Productization (auth, multi-tenant, frontend hardening)

The README lists auth/payment as explicit MVP non-goals — they belong here.

### Auth & tenancy
- AuthN (OIDC/SSO), AuthZ (roles: analyst/admin), per-tenant watchlists (`Company.watchlist` is currently a global bool — make it tenant-scoped).
- Audit logging of who viewed/exported what.

### Frontend
- **Decompose `app/page.tsx`** (725 lines) into route segments + components; move data fetching to server components / a query layer with caching, loading, and error states.
- Pagination/virtualization for the events table; real-time or polled updates.
- Accessibility pass (tooltips/heatmap already started).
- Optional: billing (Stripe) if commercializing.

### Reliability
- Horizontal scaling for API and workers; DB connection pooling; read replicas for the dashboard.
- Backup/restore + PITR for Postgres; data retention policy for raw payloads.

**Exit criteria:** multi-tenant, authenticated, scalable, with a maintainable component-based frontend.

---

## Cross-cutting: contract evolution checklist

Any change touching risk events or the dashboard must update **all three** in the same PR:
- `backend/app/models.py` (table + migration)
- `backend/app/schemas.py` (response model)
- `frontend/lib/api.ts` (TS type) + consuming UI

Add the contract test (Phase 0) so this is enforced, not remembered.

---

## Suggested sequencing

| Order | Phase | Why first |
|------:|-------|-----------|
| 1 | Phase 0 foundations | Can't safely change anything without migrations, tests, CI |
| 2 | Phase 1 ingestion (SEC first) | Real data is the core value; everything downstream needs it |
| 3 | Phase 2 extraction + summaries + pgvector | Turns raw data into the product's actual differentiator |
| 4 | Phase 4 auth (pull forward) | Needed before any external users touch real data |
| 5 | Phase 3 analytics + alerting | Scale and proactivity once data + extraction are trusted |

Auth (Phase 4) is intentionally pulled ahead of analytics: never expose real risk data without it.

## Open decisions (need product input)

- Hosting target (cloud provider / managed Postgres vs. self-hosted)?
- Orchestration choice for the worker tier (Restack, Temporal, Celery)?
- Tenancy model: single-tenant per customer vs. shared multi-tenant?
- Build vs. buy for news/GDELT ingestion?
- Acceptable LLM cost per company per refresh, and refresh cadence?
