# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SignalLens is a **mock-data MVP** for an AI-assisted public-company risk intelligence dashboard. There is no real crawling, SEC/RSS ingestion, embeddings, or LLM calls — every URL, evidence excerpt, score, and "AI-style" summary is synthetic and produced in `backend/app/seed.py`. The data model and API shapes are deliberately built to accept real ingestion later (see the roadmap in `README.md`), so preserve those forward-looking fields even though they are unused today.

## Commands

```bash
# Run everything (db + backend + frontend). Backend re-seeds on every start.
docker compose up --build

# Override ports if 5432/8000/3000 are taken
BACKEND_PORT=8010 FRONTEND_PORT=3010 POSTGRES_PORT=5433 docker compose up --build

# Frontend (run inside frontend/)
npm run dev      # next dev
npm run build    # next build
npm run lint     # eslint

# Backend reseed manually (recreates schema + mock data; run in the api container)
python -m app.seed
```

URLs: frontend http://localhost:3000 · API docs http://localhost:8000/docs · health http://localhost:8000/health

There is **no test suite** in this repo. The backend container runs `python -m app.seed && uvicorn app.main:app --reload`; both backend `app/` and frontend source are bind-mounted, so edits hot-reload without rebuilding.

## Architecture

Three services in `docker-compose.yml`: `db` (pgvector/pgvector:pg16), `backend` (FastAPI), `frontend` (Next.js).

**Backend (`backend/app/`)** — read-only API. Endpoints: `GET /health`, `/companies`, `/topics`, `/events?limit=`, `/dashboard`.
- `models.py` — SQLModel tables: `Company`, `RiskTopic`, `RiskEvent` (the core evidence object), `CompanySummary`. `RiskEvent.embedding` is a `Text` placeholder meant to become a real `Vector(1536)` pgvector column later — don't repurpose it.
- `main.py` — all routes plus the dashboard aggregation. `/dashboard` computes exposure-by-company, topic heatmap, 60-day trend, latest events, and a templated `ai_summary` (string interpolation, **not** an LLM). The "AI summary" is assembled in Python from the top-exposure company's events.
- `database.py` — `init_db()` enables the `vector` extension and runs `create_all`. Called on FastAPI startup.
- `seed.py` — on run does `init_db()` → `drop_all` → `create_all` → insert mock data. **Destructive: it drops all tables every time.** Seeds 10 fixed companies and 10 fixed risk topics.
- `config.py` — pydantic-settings; `DATABASE_URL` and `CORS_ORIGINS` (comma-separated) from env.

**Frontend (`frontend/`)** — Next.js 16 App Router, React 19, TypeScript, Tailwind 3, Recharts.
- `app/page.tsx` — the entire dashboard lives here (~725 lines): exposure chart, trend chart with selected-company state, topic heatmap, latest-events table, risk-drivers panel, and the company-detail drawer. Selection/drawer state is local React state.
- `lib/api.ts` — typed fetch client. `API_BASE_URL` from `NEXT_PUBLIC_API_BASE_URL`. The TypeScript types here mirror the backend `schemas.py` response models — keep them in sync when changing API shapes.
- `components/ui/` — minimal shadcn-style primitives (card, badge, table); no full shadcn install.

## Key conventions

- The backend response objects in `schemas.py`, the SQLModel tables in `models.py`, and the TS types in `frontend/lib/api.ts` form one contract across three files. A change to any risk-event/dashboard field usually needs edits in all three.
- Scores are ints 0–100 (`risk_score`, `exposure_score`); `confidence` is a float 0–1. Source types are the enum `SEC | RSS | Web | GDELT | CompanyReport`; severity is `low | medium | high | critical`.
- Because seeding is destructive and runs on every container start, the DB has no persisted user state worth protecting in dev — but never assume that pattern carries to a real ingestion phase.
