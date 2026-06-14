import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, SQLModel, create_engine

from app.database import get_session
from app.main import app
from app.models import (
    Company,
    CompanySummary,
    IngestionStatus,
    RiskEvent,
    RiskSeverity,
    RiskTopic,
    SourceType,
)

pytest_plugins = ["pytest_asyncio"]


@pytest.fixture(scope="session")
def test_engine():
    # SQLite in-memory with check_same_thread disabled for async compat.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture()
def db_session(test_engine):
    with Session(test_engine) as session:
        yield session
        # Roll back any uncommitted changes so tests are isolated.
        session.rollback()


@pytest_asyncio.fixture()
async def client(test_engine):
    def override_session():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# ── Factories ─────────────────────────────────────────────────────────────────

def make_topic(session: Session, name: str = "Regulation") -> RiskTopic:
    existing = session.query(RiskTopic).filter_by(name=name).first()
    if existing:
        return existing
    topic = RiskTopic(name=name, description=f"{name} risk.")
    session.add(topic)
    session.commit()
    session.refresh(topic)
    return topic


def make_company(
    session: Session,
    name: str = "Test Corp",
    ticker: str = "TEST",
) -> Company:
    existing = session.query(Company).filter_by(ticker=ticker).first()
    if existing:
        return existing
    company = Company(
        name=name,
        ticker=ticker,
        exchange="NYSE",
        country="United States",
        sector="Technology",
        watchlist=True,
    )
    session.add(company)
    session.commit()
    session.refresh(company)
    return company


def make_event(
    session: Session,
    company: Company,
    topic: RiskTopic,
    risk_score: int = 70,
) -> RiskEvent:
    from datetime import date

    event = RiskEvent(
        company_id=company.id,
        topic_id=topic.id,
        title="Test risk event",
        source_name="Test Source",
        source_url="https://example.com/test",
        source_type=SourceType.SEC,
        event_date=date.today(),
        severity=RiskSeverity.high,
        confidence=0.85,
        risk_score=risk_score,
        exposure_score=risk_score,
        summary="Test summary.",
        evidence_excerpt="Test excerpt.",
        risk_driver_summary="Test driver.",
        suggested_action="Test action.",
        raw_text="Test raw text.",
        ingestion_source="test",
        status=IngestionStatus.published,
    )
    session.add(event)
    session.commit()
    session.refresh(event)
    return event
