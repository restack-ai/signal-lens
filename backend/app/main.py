from datetime import date, timedelta

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlmodel import Session, select

from app.config import settings
from app.database import get_session, init_db
from app.models import Company, RiskEvent, RiskTopic
from app.schemas import (
    CompanyExposure,
    CompanyRead,
    DashboardRead,
    RiskEventRead,
    SummaryPanel,
    TopicHeatmapCell,
    TopicRead,
    TrendPoint,
)

app = FastAPI(title="SignalLens API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/companies", response_model=list[CompanyRead])
def list_companies(session: Session = Depends(get_session)) -> list[Company]:
    return session.exec(select(Company).order_by(Company.name)).all()


@app.get("/topics", response_model=list[TopicRead])
def list_topics(session: Session = Depends(get_session)) -> list[RiskTopic]:
    return session.exec(select(RiskTopic).order_by(RiskTopic.name)).all()


@app.get("/events", response_model=list[RiskEventRead])
def list_events(limit: int = 50, session: Session = Depends(get_session)) -> list[RiskEventRead]:
    rows = session.exec(
        select(RiskEvent, Company, RiskTopic)
        .join(Company, RiskEvent.company_id == Company.id)
        .join(RiskTopic, RiskEvent.topic_id == RiskTopic.id)
        .order_by(RiskEvent.event_date.desc(), RiskEvent.risk_score.desc())
        .limit(limit)
    ).all()
    return [
        RiskEventRead(
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
        )
        for event, company, topic in rows
    ]


@app.get("/dashboard", response_model=DashboardRead)
def dashboard(session: Session = Depends(get_session)) -> DashboardRead:
    exposure_rows = session.exec(
        select(
            Company.name.label("company_name"),
            Company.ticker.label("ticker"),
            func.round(func.avg(RiskEvent.risk_score)).label("exposure"),
            func.count(RiskEvent.id).label("event_count"),
        )
        .join(RiskEvent, RiskEvent.company_id == Company.id)
        .group_by(Company.id)
        .order_by(func.avg(RiskEvent.risk_score).desc())
    ).all()

    heatmap_rows = session.exec(
        select(
            Company.name.label("company_name"),
            RiskTopic.name.label("topic_name"),
            func.round(func.avg(RiskEvent.risk_score)).label("score"),
            func.count(RiskEvent.id).label("event_count"),
        )
        .join(RiskEvent, RiskEvent.company_id == Company.id)
        .join(RiskTopic, RiskEvent.topic_id == RiskTopic.id)
        .group_by(Company.name, RiskTopic.name)
    ).all()

    start_date = date.today() - timedelta(days=60)
    trend_rows = session.exec(
        select(
            RiskEvent.event_date,
            Company.name.label("company_name"),
            func.round(func.avg(RiskEvent.risk_score)).label("score"),
        )
        .join(Company, RiskEvent.company_id == Company.id)
        .where(RiskEvent.event_date >= start_date)
        .group_by(RiskEvent.event_date, Company.name)
        .order_by(RiskEvent.event_date)
    ).all()

    latest_events = list_events(limit=12, session=session)
    top_exposure = exposure_rows[0] if exposure_rows else None
    top_company_events = [
        event for event in latest_events if top_exposure and event.company == top_exposure.company_name
    ]
    top_company_topics = sorted(
        {event.topic for event in top_company_events},
        key=lambda topic: sum(event.risk_score for event in top_company_events if event.topic == topic),
        reverse=True,
    )
    top_driver = max(top_company_events, key=lambda event: event.risk_score, default=None)
    evidence_count = len(top_company_events)
    avg_confidence = (
        round(sum(event.confidence for event in top_company_events) / evidence_count, 2)
        if evidence_count
        else 0
    )
    summary_body = (
        f"{top_exposure.company_name} risk exposure is elevated mainly due to "
        f"{', '.join(top_company_topics[:2]) or 'seeded public-risk signals'}. "
        f"The strongest driver is {top_driver.topic if top_driver else 'a repeated risk signal'}, "
        f"supported by {evidence_count} seeded public-risk events. "
        f"Average confidence is {avg_confidence:.0%} based on mock source credibility, repeated topic signals, and extraction quality."
        if top_exposure
        else "Seed the database to generate a risk summary."
    )

    return DashboardRead(
        exposure_by_company=[
            CompanyExposure(
                company=row.company_name,
                ticker=row.ticker,
                exposure=int(row.exposure or 0),
                event_count=int(row.event_count),
            )
            for row in exposure_rows
        ],
        topic_heatmap=[
            TopicHeatmapCell(
                company=row.company_name,
                topic=row.topic_name,
                score=int(row.score or 0),
                event_count=int(row.event_count),
            )
            for row in heatmap_rows
        ],
        trend=[
            TrendPoint(date=row.event_date, company=row.company_name, score=int(row.score or 0))
            for row in trend_rows
        ],
        latest_events=latest_events,
        ai_summary=SummaryPanel(
            title="Risk Drivers",
            body=summary_body,
            generated_at=date.today(),
        ),
    )
