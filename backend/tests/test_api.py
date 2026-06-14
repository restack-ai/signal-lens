import pytest
from sqlmodel import Session

from tests.conftest import make_company, make_event, make_topic


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "environment" in data


@pytest.mark.asyncio
async def test_companies_returns_list(client, db_session: Session):
    make_company(db_session, name="Alpha Corp", ticker="ALPHA")
    response = await client.get("/companies")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    tickers = [c["ticker"] for c in body]
    assert "ALPHA" in tickers


@pytest.mark.asyncio
async def test_events_limit(client, db_session: Session):
    topic = make_topic(db_session)
    company = make_company(db_session, ticker="EVTCO")
    for i in range(15):
        make_event(db_session, company, topic, risk_score=50 + i)

    response = await client.get("/events?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data) <= 10


@pytest.mark.asyncio
async def test_events_limit_too_large_returns_422(client):
    response = await client.get("/events?limit=600")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_dashboard_keys(client, db_session: Session):
    topic = make_topic(db_session, name="Litigation")
    company = make_company(db_session, name="Dash Corp", ticker="DASH")
    make_event(db_session, company, topic)

    response = await client.get("/dashboard")
    assert response.status_code == 200
    data = response.json()
    expected_keys = {"exposure_by_company", "topic_heatmap", "trend", "latest_events", "ai_summary"}
    assert expected_keys.issubset(data.keys())


@pytest.mark.asyncio
async def test_topics_returns_list(client, db_session: Session):
    make_topic(db_session, name="Climate")
    response = await client.get("/topics")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    names = [t["name"] for t in body]
    assert "Climate" in names
