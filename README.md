# SignalLens

SignalLens is an AI-assisted public company risk intelligence dashboard. It helps analysts move from evidence to explanation to action:

1. identify which company is risky,
2. understand why it is risky,
3. inspect the evidence behind the signal,
4. see how risk changed over time,
5. decide what follow-up research to run next.

This repository is still a mock-data MVP. It does not crawl the web, fetch SEC filings, ingest RSS feeds, or call a real LLM. The seeded source URLs, evidence excerpts, scores, and AI-style summaries are synthetic placeholders designed to validate the product workflow and data model.

## Current MVP Features

- Company risk exposure chart
- Company risk trend chart with selected-company state
- Risk topic heatmap with full topic labels and accessible tooltips
- Latest risk events table with evidence excerpts, source type, confidence, and suggested actions
- Risk Drivers panel that explains the highest-risk company, strongest topics, evidence count, and average confidence
- Company Detail drawer with top topics, trend summary, related events, evidence list, AI-style summary, and suggested follow-up questions
- Scoring Methodology card for exposure, severity, confidence, and risk drivers
- Seeded mock data for 10 global public companies

## Stack

- Next.js App Router, TypeScript, Tailwind CSS, shadcn-style UI primitives
- Recharts dashboard visualizations
- FastAPI backend
- PostgreSQL with the `pgvector` extension enabled
- SQLModel and SQLAlchemy
- Docker Compose for local development

## Run Locally

```bash
docker compose up --build
```

Open:

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

If a local port is already occupied:

```bash
BACKEND_PORT=8010 FRONTEND_PORT=3010 POSTGRES_PORT=5433 docker compose up --build
```

The backend runs `python -m app.seed` before starting. The seed command recreates the local demo schema and populates mock data each time the API container starts.

## Architecture Overview

```text
.
├── backend
│   ├── app
│   │   ├── config.py      # environment-backed settings
│   │   ├── database.py    # SQLModel engine/session setup
│   │   ├── main.py        # FastAPI routes
│   │   ├── models.py      # company, topic, event, summary tables
│   │   ├── schemas.py     # API response models
│   │   └── seed.py        # seeded mock risk events
│   └── requirements.txt
├── db/init               # pgvector initialization
├── frontend
│   ├── app/page.tsx      # dashboard, selection state, detail drawer
│   ├── components/ui     # lightweight UI primitives
│   └── lib/api.ts        # typed API client
└── docker-compose.yml
```

The current API is read-oriented:

- `GET /health`
- `GET /companies`
- `GET /topics`
- `GET /events?limit=50`
- `GET /dashboard`

## Data Model Overview

Risk events are the core evidence object. The seeded model includes fields intended for future SEC, RSS, web, GDELT, and company-report ingestion:

- `id`
- `company_id`
- `company_name`
- `ticker`
- `event_date`
- `topic`
- `topic_label`
- `severity`
- `severity_score` / `risk_score`
- `exposure_score`
- `confidence_score` / `confidence`
- `source_type`: `SEC`, `RSS`, `Web`, `GDELT`, `CompanyReport`
- `source_name`
- `source_url`
- `extracted_at`
- `event_title` / `title`
- `event_summary` / `summary`
- `evidence_excerpt`
- `risk_driver_summary`
- `suggested_action`

Normalized tables link events to companies and topics. `RiskEvent.embedding` remains a text placeholder so a future migration can replace it with a real pgvector column.

## Scoring Methodology

- Exposure Score: weighted risk signal score aggregated from recent seeded events.
- Severity: event-level impact estimate based on topic, source, and language intensity.
- Confidence: reliability estimate based on source type, repeated signals, and extraction quality.
- Risk Drivers: highest-contributing topics and events behind the current exposure score.

## Mock Coverage

Companies:

- Tesla, Apple, Nvidia, Microsoft, Amazon, Alphabet, Meta, Boeing, Toyota, Samsung Electronics

Risk topics:

- Regulation
- Litigation
- Cybersecurity
- Labor
- Supply Chain
- Climate
- Accounting
- Product Safety
- Management
- Geopolitics

## Future Roadmap

Phase 1:

- Mock risk dashboard
- Company detail drawer
- Evidence-backed event schema

Phase 2:

- SEC EDGAR ingestion
- RSS ingestion
- Entity matching
- Deduplication

Phase 3:

- LLM-based structured risk extraction
- Citation-backed AI summaries
- Risk scoring evaluation set

Phase 4:

- ClickHouse and dbt analytics layer
- DuckDB local analysis
- Feast feature store
- Alerting and report generation

## Explicit Non-Goals For This MVP

- Real crawling
- Authentication
- Payment
- Real LLM API calls
- dbt
- ClickHouse
- Feast
