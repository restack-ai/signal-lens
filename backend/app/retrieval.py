"""Shared event retrieval — semantic (pgvector KNN) with a recency fallback.

Phase 3. `semantic_search` embeds the query and ranks events by vector
similarity over the `embedding` column; when no query embedding can be
computed (no OpenAI key), no events are embedded yet, or pgvector is
unavailable (e.g. SQLite in tests), it transparently falls back to
recency/severity ordering. One retrieval path backs both `/search` and the
grounded copilot.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import text
from sqlmodel import Session, select

from app.config import settings
from app.logging import get_logger
from app.models import Company, RiskEvent, RiskTopic
from app.schemas import RiskEventRead

logger = get_logger(__name__)

_MOCK_INGESTION_SOURCE = "mock_seed"


def _event_read_from_orm(
    event: RiskEvent, company: Company, topic: RiskTopic
) -> RiskEventRead:
    return RiskEventRead(
        id=event.id,
        title=event.title,
        company_id=company.id,
        company=company.name,
        ticker=company.ticker,
        topic=topic.name,
        topic_label=topic.name,
        source_type=event.source_type,
        source_name=event.source_name,
        source_url=event.source_url,
        extracted_at=event.extracted_at,
        event_date=event.event_date,
        severity=event.severity,
        confidence=event.confidence,
        risk_score=event.risk_score,
        exposure_score=event.exposure_score,
        summary=event.summary,
        evidence_excerpt=event.evidence_excerpt,
        risk_driver_summary=event.risk_driver_summary,
        suggested_action=event.suggested_action,
        status=event.status,
        fetched_at=event.fetched_at,
        content_hash=event.content_hash,
    )


def recency_search(
    session: Session, *, limit: int, ticker: Optional[str] = None
) -> list[RiskEventRead]:
    """Most recent / highest-risk events, with the mock-data visibility filter."""
    query = (
        select(RiskEvent, Company, RiskTopic)
        .join(Company, RiskEvent.company_id == Company.id)
        .join(RiskTopic, RiskEvent.topic_id == RiskTopic.id)
        .order_by(RiskEvent.event_date.desc(), RiskEvent.risk_score.desc())
        .limit(limit)
    )
    if settings.real_ingestion_mode:
        query = query.where(RiskEvent.ingestion_source != _MOCK_INGESTION_SOURCE)
    if ticker:
        query = query.where(Company.ticker == ticker)
    return [_event_read_from_orm(e, c, t) for e, c, t in session.exec(query).all()]


def semantic_search(
    session: Session, query: str, *, limit: int, ticker: Optional[str] = None
) -> list[RiskEventRead]:
    """Rank events by vector similarity to `query`; fall back to recency."""
    # Lazy import keeps the extractor's heavy deps out of request startup.
    from app.extraction.extractor import RiskExtractor

    query_embedding = RiskExtractor().embed(query)
    if not query_embedding:
        return recency_search(session, limit=limit, ticker=ticker)

    embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"
    try:
        rows = session.exec(
            text(
                """
                SELECT e.id, c.id AS company_id, c.name AS company_name, c.ticker,
                       t.name AS topic_name,
                       e.source_type, e.source_name, e.source_url, e.extracted_at,
                       e.event_date, e.severity, e.confidence, e.risk_score,
                       e.exposure_score, e.summary, e.evidence_excerpt,
                       e.risk_driver_summary, e.suggested_action,
                       e.title, e.status, e.fetched_at, e.content_hash
                FROM riskevent e
                JOIN company c ON e.company_id = c.id
                JOIN risktopic t ON e.topic_id = t.id
                WHERE e.embedding IS NOT NULL
                  AND (:include_mock OR e.ingestion_source != :mock_ingestion_source)
                  AND (:ticker IS NULL OR c.ticker = :ticker)
                ORDER BY e.embedding <=> CAST(:embedding AS vector)
                LIMIT :limit
                """
            ).bindparams(
                embedding=embedding_str,
                include_mock=not settings.real_ingestion_mode,
                mock_ingestion_source=_MOCK_INGESTION_SOURCE,
                ticker=ticker,
                limit=limit,
            )
        ).all()  # type: ignore[call-overload]
    except Exception as exc:  # noqa: BLE001 — pgvector missing or query error
        logger.warning("semantic search failed; using recency", error=str(exc))
        return recency_search(session, limit=limit, ticker=ticker)

    # No events embedded yet → recency keeps results useful.
    if not rows:
        return recency_search(session, limit=limit, ticker=ticker)

    return [
        RiskEventRead(
            id=row.id,
            title=row.title,
            company_id=row.company_id,
            company=row.company_name,
            ticker=row.ticker,
            topic=row.topic_name,
            topic_label=row.topic_name,
            source_type=row.source_type,
            source_name=row.source_name,
            source_url=row.source_url,
            extracted_at=row.extracted_at,
            event_date=row.event_date,
            severity=row.severity,
            confidence=row.confidence,
            risk_score=row.risk_score,
            exposure_score=row.exposure_score,
            summary=row.summary,
            evidence_excerpt=row.evidence_excerpt,
            risk_driver_summary=row.risk_driver_summary,
            suggested_action=row.suggested_action,
            status=row.status,
            fetched_at=row.fetched_at,
            content_hash=row.content_hash,
        )
        for row in rows
    ]
