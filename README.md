# SignalLens

SignalLens is an AI-powered company risk intelligence dashboard for monitoring global public companies with public web data, RSS feeds, and SEC filings. This MVP uses seeded mock data only. The schema and service boundaries are designed so real ingestion workers can be added later.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS, shadcn-style UI primitives
- Recharts dashboard visualizations
- FastAPI backend
- PostgreSQL with `pgvector` extension enabled
- SQLModel and SQLAlchemy
- Docker Compose for local development

## Project Structure

```text
.
├── backend
│   ├── app
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── seed.py
│   ├── Dockerfile
│   └── requirements.txt
├── db
│   └── init
│       └── 001_pgvector.sql
├── frontend
│   ├── app
│   ├── components
│   ├── lib
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml
```

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

The backend runs `python -m app.seed` before starting, so the local database is populated with mock data for 10 companies each time the API container starts.

## Mock Coverage

Companies:

- Tesla, Apple, Nvidia, Microsoft, Amazon, Alphabet, Meta, Boeing, Toyota, Samsung Electronics

Risk topics:

- Regulation, Litigation, Cybersecurity, Labor, Supply Chain, Climate, Accounting, Product Safety, Management, Geopolitics

## API

- `GET /health`
- `GET /companies`
- `GET /topics`
- `GET /events?limit=50`
- `GET /dashboard`

## Ingestion Architecture

Real crawling is intentionally not implemented in this MVP. Future workers can write into the existing `risk_event` table using:

- `company_id` and `topic_id` for normalized linking
- `source_name`, `source_url`, `event_date`, and `raw_text` for traceability
- `risk_score`, `severity`, and `confidence` for model output
- `embedding` as a pgvector-ready placeholder column
- `ingestion_source` to distinguish RSS, SEC, web, or vendor pipelines

Recommended next worker layout:

```text
backend/app/ingestion/
├── rss_worker.py
├── sec_worker.py
├── web_worker.py
├── classifier.py
└── embeddings.py
```

When real embeddings are added, replace the text placeholder with a pgvector column type through a migration.
