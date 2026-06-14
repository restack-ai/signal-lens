from datetime import date, datetime, timedelta

from sqlmodel import Session, select

from app.ingestion.dedup import compute_content_hash, is_duplicate
from app.ingestion.entity_matcher import EntityMatcher
from app.ingestion.rss import RSSIngester
from app.ingestion.sec import SECIngester
from app.logging import get_logger
from app.models import (
    Company,
    EventSource,
    IngestionStatus,
    RiskEvent,
    RiskSeverity,
    RiskTopic,
    SourceType,
)

logger = get_logger(__name__)

_DEFAULT_TOPIC_NAME = "Regulation"


class IngestPipeline:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._matcher = EntityMatcher(session)
        # Resolve a fallback topic for events whose topic cannot be determined
        # at ingestion time (extraction sets the real topic later).
        fallback_topic = session.exec(
            select(RiskTopic).where(RiskTopic.name == _DEFAULT_TOPIC_NAME)
        ).first()
        self._fallback_topic_id: int = fallback_topic.id if fallback_topic else 1

    def ingest(
        self,
        *,
        title: str,
        source_url: str,
        source_name: str,
        source_type: SourceType,
        raw_text: str,
        company_ticker: str,
        fetched_at: datetime,
        event_date: date,
    ) -> RiskEvent | None:
        content_hash = compute_content_hash(title, source_url)
        if is_duplicate(self._session, content_hash):
            logger.debug("Skipping duplicate event", content_hash=content_hash, url=source_url)
            return None

        match = self._matcher.match(company_ticker)
        if match is None:
            logger.warning("No company match", ticker=company_ticker)
            return None
        company_id, _confidence = match

        event = RiskEvent(
            company_id=company_id,
            topic_id=self._fallback_topic_id,
            title=title,
            source_name=source_name,
            source_url=source_url,
            source_type=source_type,
            event_date=event_date,
            severity=RiskSeverity.low,
            confidence=0.5,
            risk_score=0,
            exposure_score=0,
            summary="",
            evidence_excerpt="",
            risk_driver_summary="",
            suggested_action="",
            raw_text=raw_text,
            ingestion_source=source_type.value.lower(),
            status=IngestionStatus.raw,
            fetched_at=fetched_at,
            content_hash=content_hash,
        )
        self._session.add(event)
        self._session.flush()  # populate event.id before creating the source row

        source_row = EventSource(
            event_id=event.id,
            source_type=source_type,
            source_name=source_name,
            source_url=source_url,
            fetched_at=fetched_at,
        )
        self._session.add(source_row)
        self._session.commit()
        logger.info("Ingested event", event_id=event.id, title=title)
        return event


def run_sec_ingestion(session: Session, days_back: int = 7) -> None:
    ingester = SECIngester()
    pipeline = IngestPipeline(session)
    companies = session.exec(select(Company)).all()
    now = datetime.utcnow()

    for company in companies:
        try:
            filings = ingester.fetch_recent_filings(company.ticker, days_back=days_back)
        except Exception as exc:
            logger.error("SEC ingestion failed", ticker=company.ticker, error=str(exc))
            continue

        for filing in filings:
            raw_text = ingester.fetch_filing_text(filing.get("url", "")) if filing.get("url") else ""
            filed_at_str = filing.get("filed_at", "")
            try:
                event_date = date.fromisoformat(filed_at_str) if filed_at_str else date.today()
            except ValueError:
                event_date = date.today()

            pipeline.ingest(
                title=filing.get("title", "SEC Filing"),
                source_url=filing.get("url", ""),
                source_name=filing.get("form_type", "SEC"),
                source_type=SourceType.SEC,
                raw_text=raw_text,
                company_ticker=company.ticker,
                fetched_at=now,
                event_date=event_date,
            )
    ingester.close()


def run_rss_ingestion(session: Session, days_back: int = 1) -> None:
    ingester = RSSIngester()
    pipeline = IngestPipeline(session)
    companies = session.exec(select(Company)).all()
    cutoff = datetime.utcnow() - timedelta(days=days_back)

    for company in companies:
        try:
            items = ingester.fetch_company_feed(company.ticker)
        except Exception as exc:
            logger.error("RSS ingestion failed", ticker=company.ticker, error=str(exc))
            continue

        for item in items:
            published_str = item.get("published")
            try:
                published_dt = datetime.fromisoformat(published_str) if published_str else datetime.utcnow()
            except ValueError:
                published_dt = datetime.utcnow()

            if published_dt < cutoff:
                continue

            pipeline.ingest(
                title=item.get("title", "RSS item"),
                source_url=item.get("url", ""),
                source_name=item.get("source_name", "RSS"),
                source_type=SourceType.RSS,
                raw_text=item.get("summary", ""),
                company_ticker=company.ticker,
                fetched_at=datetime.utcnow(),
                event_date=published_dt.date(),
            )
