from datetime import date, datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, Text
from sqlmodel import Field, Relationship, SQLModel

try:
    from pgvector.sqlalchemy import Vector

    EmbeddingColumn = Column(Vector(1536), nullable=True)
except ImportError:
    EmbeddingColumn = Column(Text, nullable=True)


class RiskSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class SourceType(str, Enum):
    SEC = "SEC"
    RSS = "RSS"
    Web = "Web"
    GDELT = "GDELT"
    CompanyReport = "CompanyReport"


class IngestionStatus(str, Enum):
    raw = "raw"
    extracted = "extracted"
    scored = "scored"
    published = "published"
    error = "error"


class UserRole(str, Enum):
    analyst = "analyst"
    admin = "admin"


# ── Tenant / Auth ─────────────────────────────────────────────────────────────

class Tenant(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    users: list["User"] = Relationship(back_populates="tenant")
    watchlists: list["TenantWatchlist"] = Relationship(back_populates="tenant")


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    role: UserRole = Field(default=UserRole.analyst)
    tenant_id: int = Field(foreign_key="tenant.id", index=True)
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    tenant: Tenant = Relationship(back_populates="users")


class TenantWatchlist(SQLModel, table=True):
    tenant_id: int = Field(foreign_key="tenant.id", primary_key=True)
    company_id: int = Field(foreign_key="company.id", primary_key=True)
    added_at: datetime = Field(default_factory=datetime.utcnow)

    tenant: Tenant = Relationship(back_populates="watchlists")


# ── Core domain ───────────────────────────────────────────────────────────────

class CompanyBase(SQLModel):
    name: str = Field(index=True)
    ticker: str = Field(index=True, unique=True)
    exchange: str
    country: str
    sector: str
    watchlist: bool = True


class Company(CompanyBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    events: list["RiskEvent"] = Relationship(back_populates="company")
    summaries: list["CompanySummary"] = Relationship(back_populates="company")


class RiskTopicBase(SQLModel):
    name: str = Field(index=True, unique=True)
    description: str


class RiskTopic(RiskTopicBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    events: list["RiskEvent"] = Relationship(back_populates="topic")


class RiskEventBase(SQLModel):
    title: str
    source_name: str
    source_url: str
    source_type: SourceType = Field(default=SourceType.Web, index=True)
    event_date: date = Field(index=True)
    severity: RiskSeverity = Field(index=True)
    confidence: float = Field(ge=0, le=1)
    risk_score: int = Field(ge=0, le=100, index=True)
    exposure_score: int = Field(default=0, ge=0, le=100, index=True)
    summary: str = Field(sa_column=Column(Text))
    evidence_excerpt: str = Field(default="", sa_column=Column(Text))
    risk_driver_summary: str = Field(default="", sa_column=Column(Text))
    suggested_action: str = Field(default="", sa_column=Column(Text))
    extracted_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    raw_text: str = Field(sa_column=Column(Text))
    ingestion_source: str = Field(default="mock_seed")
    # Ingestion pipeline fields added in Phase 1A
    status: IngestionStatus = Field(default=IngestionStatus.published, index=True)
    fetched_at: Optional[datetime] = Field(default=None, index=True)
    content_hash: Optional[str] = Field(default=None, index=True)
    retry_count: int = Field(default=0, index=True)
    error_message: Optional[str] = Field(default=None, sa_column=Column(Text))


class RiskEvent(RiskEventBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    company_id: int = Field(foreign_key="company.id", index=True)
    topic_id: int = Field(foreign_key="risktopic.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    embedding: Optional[list[float]] = Field(default=None, sa_column=EmbeddingColumn)

    company: Company = Relationship(back_populates="events")
    topic: RiskTopic = Relationship(back_populates="events")
    sources: list["EventSource"] = Relationship(back_populates="event")


class EventSource(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: int = Field(foreign_key="riskevent.id", index=True)
    source_type: SourceType
    source_name: str
    source_url: str
    fetched_at: datetime = Field(default_factory=datetime.utcnow)
    # Object-store key for the raw payload; empty until Phase 3 object storage is wired.
    raw_payload_key: str = Field(default="")

    event: "RiskEvent" = Relationship(back_populates="sources")


class CompanySummaryBase(SQLModel):
    summary_date: date = Field(index=True)
    risk_score: int = Field(ge=0, le=100)
    summary: str = Field(sa_column=Column(Text))
    model_name: str = "mock-risk-summarizer"


class CompanySummary(CompanySummaryBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    company_id: int = Field(foreign_key="company.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    company: Company = Relationship(back_populates="summaries")
