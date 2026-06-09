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
            company=company.name,
            ticker=company.ticker,
            topic=topic.name,
            source_name=event.source_name,
            source_url=event.source_url,
            event_date=event.event_date,
            severity=event.severity,
            confidence=event.confidence,
            risk_score=event.risk_score,
            summary=event.summary,
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
    top_topic = max(heatmap_rows, key=lambda row: row.score or 0) if heatmap_rows else None
    summary_body = (
        f"{top_exposure.company_name} currently has the highest seeded exposure score at {int(top_exposure.exposure)}. "
        f"The strongest topic signal is {top_topic.topic_name} for {top_topic.company_name}, based on mock public-risk events. "
        "Real RSS, web, and SEC ingestion workers can attach to the same event schema later."
        if top_exposure and top_topic
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
            title="AI Risk Brief",
            body=summary_body,
            generated_at=date.today(),
        ),
    )
