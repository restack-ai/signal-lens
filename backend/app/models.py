from datetime import date, datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, Text
from sqlmodel import Field, Relationship, SQLModel


class RiskSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


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
    event_date: date = Field(index=True)
    severity: RiskSeverity = Field(index=True)
    confidence: float = Field(ge=0, le=1)
    risk_score: int = Field(ge=0, le=100, index=True)
    summary: str = Field(sa_column=Column(Text))
    raw_text: str = Field(sa_column=Column(Text))
    ingestion_source: str = Field(default="mock_seed")


class RiskEvent(RiskEventBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    company_id: int = Field(foreign_key="company.id", index=True)
    topic_id: int = Field(foreign_key="risktopic.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # pgvector-ready placeholder. Replace with Vector(1536) when the app starts
    # storing real embeddings through sqlalchemy-pgvector.
    embedding: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))

    company: Company = Relationship(back_populates="events")
    topic: RiskTopic = Relationship(back_populates="events")


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
