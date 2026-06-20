"""Backfill pgvector embeddings for events that don't have one yet.

The extraction worker embeds each event as it is scored; this command fills in
embeddings for events that were ingested before embedding was wired (or while
no OpenAI key was configured). Idempotent — only touches rows where
`embedding IS NULL`. No-ops with a clear message when OPENAI_API_KEY is unset.

Run inside the api/worker container:
    python -m app.embed_backfill            # embed all missing
    python -m app.embed_backfill --limit 500
"""
from __future__ import annotations

import argparse

from sqlmodel import Session, select

from app.config import settings
from app.database import engine
from app.logging import configure_logging, get_logger
from app.models import RiskEvent

logger = get_logger(__name__)


def backfill(limit: int | None = None, batch_size: int = 50) -> int:
    """Embed events missing an embedding. Returns the number embedded."""
    if not settings.openai_api_key:
        logger.warning(
            "OPENAI_API_KEY not set; cannot generate embeddings — nothing to do"
        )
        return 0

    # Imported lazily so the command only pays the extractor's import cost on use.
    from app.extraction.extractor import RiskExtractor

    extractor = RiskExtractor()
    embedded = 0
    with Session(engine) as session:
        query = (
            select(RiskEvent)
            .where(RiskEvent.embedding.is_(None))  # type: ignore[union-attr]
            .order_by(RiskEvent.id)
        )
        if limit is not None:
            query = query.limit(limit)
        events = session.exec(query).all()
        logger.info("embedding backfill starting", candidates=len(events))

        for i, event in enumerate(events, 1):
            source_text = event.raw_text or f"{event.title}\n{event.evidence_excerpt}"
            vector = extractor.embed(source_text)
            if not vector:
                # embed() already logged the failure; keep going.
                continue
            event.embedding = vector
            session.add(event)
            embedded += 1
            if i % batch_size == 0:
                session.commit()
                logger.info("embedding backfill progress", embedded=embedded, scanned=i)

        session.commit()

    logger.info("embedding backfill complete", embedded=embedded)
    return embedded


def main() -> None:
    configure_logging()
    parser = argparse.ArgumentParser(description="Backfill RiskEvent embeddings")
    parser.add_argument("--limit", type=int, default=None, help="Max events to embed")
    args = parser.parse_args()
    count = backfill(limit=args.limit)
    print(f"Embedded {count} events")


if __name__ == "__main__":
    main()
