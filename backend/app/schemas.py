from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.models import IngestionStatus, RiskSeverity, SourceType, UserRole


class CompanyRead(BaseModel):
    id: int
    name: str
    ticker: str
    exchange: str
    country: str
    sector: str
    watchlist: bool


class TopicRead(BaseModel):
    id: int
    name: str
    description: str


class RiskEventRead(BaseModel):
    id: int
    title: str
    company_id: int
    company: str
    ticker: str
    topic: str
    topic_label: str
    source_type: SourceType
    source_name: str
    source_url: str
    extracted_at: datetime
    event_date: date
    severity: RiskSeverity
    confidence: float
    risk_score: int
    exposure_score: int
    summary: str
    evidence_excerpt: str
    risk_driver_summary: str
    suggested_action: str
    status: IngestionStatus
    fetched_at: Optional[datetime] = None
    content_hash: Optional[str] = None


class CompanyExposure(BaseModel):
    company: str
    ticker: str
    exposure: int
    event_count: int


class TopicHeatmapCell(BaseModel):
    company: str
    topic: str
    score: int
    event_count: int


class TrendPoint(BaseModel):
    date: date
    company: str
    score: int


class SummaryPanel(BaseModel):
    title: str
    body: str
    generated_at: date


class DashboardRead(BaseModel):
    exposure_by_company: list[CompanyExposure]
    topic_heatmap: list[TopicHeatmapCell]
    trend: list[TrendPoint]
    latest_events: list[RiskEventRead]
    ai_summary: SummaryPanel


# ── Auth schemas ──────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    tenant_name: str


class LoginRequest(BaseModel):
    username: str  # OAuth2 form field name
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    id: int
    email: str
    role: UserRole
    tenant_id: int
    is_active: bool
