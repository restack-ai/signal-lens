from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery("signallens", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.timezone = "UTC"
celery_app.conf.beat_schedule = {
    "ingest-sec-daily": {
        "task": "app.worker.ingest_sec",
        "schedule": crontab(hour=6, minute=0),
    },
    "ingest-rss-hourly": {
        "task": "app.worker.ingest_rss",
        "schedule": crontab(minute=0),
    },
    "extract-pending-hourly": {
        "task": "app.worker.extract_pending",
        "schedule": crontab(minute=15),
    },
    "summarize-daily": {
        "task": "app.worker.summarize_companies",
        "schedule": crontab(hour=7, minute=0),
    },
    "check-alerts-hourly": {
        "task": "app.worker.check_alerts",
        "schedule": crontab(minute=30),
    },
}


@celery_app.task(name="app.worker.ingest_sec")
def ingest_sec() -> None:
    from app.database import engine
    from app.ingestion.pipeline import run_sec_ingestion
    from sqlmodel import Session

    with Session(engine) as session:
        run_sec_ingestion(session, days_back=7)


@celery_app.task(name="app.worker.ingest_rss")
def ingest_rss() -> None:
    from app.database import engine
    from app.ingestion.pipeline import run_rss_ingestion
    from sqlmodel import Session

    with Session(engine) as session:
        run_rss_ingestion(session, days_back=1)


@celery_app.task(name="app.worker.extract_pending")
def extract_pending() -> None:
    """Extract and score all RiskEvent rows currently in 'raw' status."""
    from datetime import date

    from sqlmodel import Session, select

    from app.database import engine
    from app.extraction.extractor import RiskExtractor
    from app.models import IngestionStatus, RiskEvent, RiskSeverity, RiskTopic

    extractor = RiskExtractor()

    with Session(engine) as session:
        pending = session.exec(
            select(RiskEvent).where(RiskEvent.status == IngestionStatus.raw)
        ).all()

        for event in pending:
            company = event.company
            try:
                results = extractor.extract(
                    raw_text=event.raw_text,
                    company_name=company.name if company else "",
                    source_type=event.source_type.value,
                )
            except Exception:
                continue

            if not results:
                continue

            best = results[0]

            # Resolve topic row; create if missing (shouldn't happen in prod).
            topic_row = session.exec(
                select(RiskTopic).where(RiskTopic.name == best.topic)
            ).first()
            if topic_row:
                event.topic_id = topic_row.id

            event.title = best.title
            event.severity = RiskSeverity(best.severity)
            event.risk_score = best.risk_score
            event.confidence = best.confidence
            event.evidence_excerpt = best.evidence_excerpt
            event.risk_driver_summary = best.risk_driver_summary
            event.suggested_action = best.suggested_action
            event.status = IngestionStatus.extracted

            if best.embedding:
                event.embedding = best.embedding
            elif not event.embedding:
                event.embedding = extractor.embed(event.raw_text)

            session.add(event)

        session.commit()


@celery_app.task(name="app.worker.summarize_companies")
def summarize_companies() -> None:
    from sqlmodel import Session

    from app.database import engine
    from app.extraction.summarizer import CompanySummarizer

    summarizer = CompanySummarizer()
    with Session(engine) as session:
        summarizer.run_for_all_companies(session)


@celery_app.task(name="app.worker.check_alerts")
def check_alerts() -> None:
    """Check all configured alert rules and log any triggered alerts."""
    from sqlmodel import Session

    from app.analytics.alerts import AlertEngine, AlertRule
    from app.database import engine

    # Alert rules are loaded from env/config in a real deployment. For now
    # the engine starts with an empty rule set; operators add rules via the
    # admin API (Phase 4 extension).
    rules: list[AlertRule] = []
    engine_instance = AlertEngine(rules)

    with Session(engine) as session:
        triggered = engine_instance.check(session)
        for alert in triggered:
            engine_instance.send(alert, session=session)
