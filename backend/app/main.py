from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import func, text
from sqlmodel import Session, select

from app.auth.dependencies import get_current_user, get_optional_user, require_admin
from app.auth.security import create_access_token, hash_password, verify_password
from app.config import settings
from app.database import get_session, init_db
from app.logging import RequestIDMiddleware, configure_logging, get_logger
from app.models import (
    Company,
    RiskEvent,
    RiskTopic,
    Tenant,
    TenantWatchlist,
    User,
    UserRole,
)
from app.schemas import (
    CompanyExposure,
    CompanyRead,
    DashboardRead,
    RegisterRequest,
    RiskEventRead,
    SummaryPanel,
    TokenResponse,
    TopicHeatmapCell,
    TopicRead,
    TrendPoint,
    UserRead,
)

configure_logging()
logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.sentry_dsn:
        import sentry_sdk

        sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.environment)
        logger.info("Sentry initialized", environment=settings.environment)

    init_db()
    logger.info("SignalLens API started", environment=settings.environment)
    yield


limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app = FastAPI(title="SignalLens API", version="0.2.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}


# ── Public read endpoints ─────────────────────────────────────────────────────

@app.get("/companies", response_model=list[CompanyRead])
@limiter.limit("100/minute")
def list_companies(
    request: Request,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_user),
) -> list[Company]:
    if current_user is not None:
        # Return only companies on this tenant's watchlist.
        watchlist_ids = session.exec(
            select(TenantWatchlist.company_id).where(
                TenantWatchlist.tenant_id == current_user.tenant_id
            )
        ).all()
        if watchlist_ids:
            return session.exec(
                select(Company)
                .where(Company.id.in_(watchlist_ids))
                .order_by(Company.name)
            ).all()
    return session.exec(select(Company).order_by(Company.name)).all()


@app.get("/topics", response_model=list[TopicRead])
@limiter.limit("100/minute")
def list_topics(
    request: Request,
    session: Session = Depends(get_session),
) -> list[RiskTopic]:
    return session.exec(select(RiskTopic).order_by(RiskTopic.name)).all()


@app.get("/events", response_model=list[RiskEventRead])
@limiter.limit("100/minute")
def list_events(
    request: Request,
    limit: int = Query(default=50, ge=1, le=500),
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_user),
) -> list[RiskEventRead]:
    return _fetch_events(limit=limit, session=session, current_user=current_user)


def _fetch_events(
    limit: int,
    session: Session,
    current_user: Optional[User] = None,
) -> list[RiskEventRead]:
    query = (
        select(RiskEvent, Company, RiskTopic)
        .join(Company, RiskEvent.company_id == Company.id)
        .join(RiskTopic, RiskEvent.topic_id == RiskTopic.id)
        .order_by(RiskEvent.event_date.desc(), RiskEvent.risk_score.desc())
        .limit(limit)
    )

    if current_user is not None:
        watchlist_ids = session.exec(
            select(TenantWatchlist.company_id).where(
                TenantWatchlist.tenant_id == current_user.tenant_id
            )
        ).all()
        if watchlist_ids:
            query = query.where(Company.id.in_(watchlist_ids))

    rows = session.exec(query).all()
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
            status=event.status,
            fetched_at=event.fetched_at,
            content_hash=event.content_hash,
        )
        for event, company, topic in rows
    ]


@app.get("/dashboard", response_model=DashboardRead)
@limiter.limit("60/minute")
def dashboard(
    request: Request,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_user),
) -> DashboardRead:
    watchlist_filter: Optional[list[int]] = None
    if current_user is not None:
        wl = session.exec(
            select(TenantWatchlist.company_id).where(
                TenantWatchlist.tenant_id == current_user.tenant_id
            )
        ).all()
        if wl:
            watchlist_filter = list(wl)

    base_query = select(
        Company.name.label("company_name"),
        Company.ticker.label("ticker"),
        func.round(func.avg(RiskEvent.risk_score)).label("exposure"),
        func.count(RiskEvent.id).label("event_count"),
    ).join(RiskEvent, RiskEvent.company_id == Company.id)

    if watchlist_filter:
        base_query = base_query.where(Company.id.in_(watchlist_filter))

    exposure_rows = session.exec(
        base_query.group_by(Company.id).order_by(func.avg(RiskEvent.risk_score).desc())
    ).all()

    heatmap_query = select(
        Company.name.label("company_name"),
        RiskTopic.name.label("topic_name"),
        func.round(func.avg(RiskEvent.risk_score)).label("score"),
        func.count(RiskEvent.id).label("event_count"),
    ).join(RiskEvent, RiskEvent.company_id == Company.id).join(
        RiskTopic, RiskEvent.topic_id == RiskTopic.id
    )
    if watchlist_filter:
        heatmap_query = heatmap_query.where(Company.id.in_(watchlist_filter))

    heatmap_rows = session.exec(heatmap_query.group_by(Company.name, RiskTopic.name)).all()

    start_date = date.today() - timedelta(days=60)
    trend_query = select(
        RiskEvent.event_date,
        Company.name.label("company_name"),
        func.round(func.avg(RiskEvent.risk_score)).label("score"),
    ).join(Company, RiskEvent.company_id == Company.id).where(RiskEvent.event_date >= start_date)
    if watchlist_filter:
        trend_query = trend_query.where(Company.id.in_(watchlist_filter))

    trend_rows = session.exec(
        trend_query.group_by(RiskEvent.event_date, Company.name).order_by(RiskEvent.event_date)
    ).all()

    latest_events = _fetch_events(limit=12, session=session, current_user=current_user)
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
        f"{', '.join(top_company_topics[:2]) or 'public-risk signals'}. "
        f"The strongest driver is {top_driver.topic if top_driver else 'a repeated risk signal'}, "
        f"supported by {evidence_count} risk events. "
        f"Average confidence is {avg_confidence:.0%}."
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


# ── Semantic search ───────────────────────────────────────────────────────────

@app.get("/search", response_model=list[RiskEventRead])
@limiter.limit("30/minute")
def search_events(
    request: Request,
    q: str = Query(min_length=1, max_length=500),
    limit: int = Query(default=10, ge=1, le=100),
    session: Session = Depends(get_session),
) -> list[RiskEventRead]:
    # Embed the query; stub returns zeros until a real embedding model is wired.
    from app.extraction.extractor import RiskExtractor

    extractor = RiskExtractor()
    query_embedding = extractor.embed(q)

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
                ORDER BY e.embedding <=> CAST(:embedding AS vector)
                LIMIT :limit
                """
            ).bindparams(embedding=embedding_str, limit=limit)
        ).all()  # type: ignore[call-overload]
    except Exception:
        # Fallback to recency-ordered results when pgvector is unavailable
        # (e.g., during tests against SQLite).
        return _fetch_events(limit=limit, session=session)

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


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def register(
    request: Request,
    body: RegisterRequest,
    session: Session = Depends(get_session),
) -> User:
    if session.exec(select(User).where(User.email == body.email)).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    tenant = session.exec(select(Tenant).where(Tenant.name == body.tenant_name)).first()
    if tenant is None:
        tenant = Tenant(name=body.tenant_name)
        session.add(tenant)
        session.flush()

    existing_users_in_tenant = session.exec(
        select(User).where(User.tenant_id == tenant.id)
    ).all()
    # First user on a tenant becomes admin.
    role = UserRole.admin if not existing_users_in_tenant else UserRole.analyst

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        role=role,
        tenant_id=tenant.id,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    logger.info("User registered", email=user.email, tenant=body.tenant_name, role=role)
    return user


@app.post("/auth/login", response_model=TokenResponse)
@limiter.limit("20/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
) -> TokenResponse:
    user = session.exec(select(User).where(User.email == form_data.username)).first()
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account is inactive")

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


@app.get("/auth/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


# ── Watchlist ─────────────────────────────────────────────────────────────────

@app.get("/watchlist", response_model=list[CompanyRead])
@limiter.limit("60/minute")
def get_watchlist(
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[Company]:
    watchlist_ids = session.exec(
        select(TenantWatchlist.company_id).where(
            TenantWatchlist.tenant_id == current_user.tenant_id
        )
    ).all()
    if not watchlist_ids:
        return []
    return session.exec(
        select(Company).where(Company.id.in_(watchlist_ids)).order_by(Company.name)
    ).all()


@app.post("/watchlist/{company_id}", status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
def add_to_watchlist(
    request: Request,
    company_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin),
) -> dict[str, str]:
    company = session.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")

    existing = session.exec(
        select(TenantWatchlist).where(
            TenantWatchlist.tenant_id == current_user.tenant_id,
            TenantWatchlist.company_id == company_id,
        )
    ).first()
    if existing:
        return {"detail": "Already on watchlist"}

    session.add(TenantWatchlist(tenant_id=current_user.tenant_id, company_id=company_id))
    session.commit()
    return {"detail": "Added to watchlist"}


@app.delete("/watchlist/{company_id}", status_code=status.HTTP_200_OK)
@limiter.limit("30/minute")
def remove_from_watchlist(
    request: Request,
    company_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin),
) -> dict[str, str]:
    entry = session.exec(
        select(TenantWatchlist).where(
            TenantWatchlist.tenant_id == current_user.tenant_id,
            TenantWatchlist.company_id == company_id,
        )
    ).first()
    if entry is None:
        raise HTTPException(status_code=404, detail="Company not on watchlist")
    session.delete(entry)
    session.commit()
    return {"detail": "Removed from watchlist"}
