"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2026-01-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "company",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("ticker", sa.String(), nullable=False),
        sa.Column("exchange", sa.String(), nullable=False),
        sa.Column("country", sa.String(), nullable=False),
        sa.Column("sector", sa.String(), nullable=False),
        sa.Column("watchlist", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_company_name"), "company", ["name"], unique=False)
    op.create_index(op.f("ix_company_ticker"), "company", ["ticker"], unique=True)

    op.create_table(
        "risktopic",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_risktopic_name"), "risktopic", ["name"], unique=True)

    op.create_table(
        "riskevent",
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("source_name", sa.String(), nullable=False),
        sa.Column("source_url", sa.String(), nullable=False),
        sa.Column("source_type", sa.String(), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("severity", sa.String(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("risk_score", sa.Integer(), nullable=False),
        sa.Column("exposure_score", sa.Integer(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("evidence_excerpt", sa.Text(), nullable=False),
        sa.Column("risk_driver_summary", sa.Text(), nullable=False),
        sa.Column("suggested_action", sa.Text(), nullable=False),
        sa.Column("extracted_at", sa.DateTime(), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("ingestion_source", sa.String(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("topic_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("embedding", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["company.id"]),
        sa.ForeignKeyConstraint(["topic_id"], ["risktopic.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_riskevent_event_date"), "riskevent", ["event_date"], unique=False)
    op.create_index(op.f("ix_riskevent_extracted_at"), "riskevent", ["extracted_at"], unique=False)
    op.create_index(op.f("ix_riskevent_exposure_score"), "riskevent", ["exposure_score"], unique=False)
    op.create_index(op.f("ix_riskevent_risk_score"), "riskevent", ["risk_score"], unique=False)
    op.create_index(op.f("ix_riskevent_severity"), "riskevent", ["severity"], unique=False)
    op.create_index(op.f("ix_riskevent_source_type"), "riskevent", ["source_type"], unique=False)
    op.create_index(op.f("ix_riskevent_company_id"), "riskevent", ["company_id"], unique=False)
    op.create_index(op.f("ix_riskevent_topic_id"), "riskevent", ["topic_id"], unique=False)

    op.create_table(
        "companysummary",
        sa.Column("summary_date", sa.Date(), nullable=False),
        sa.Column("risk_score", sa.Integer(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("model_name", sa.String(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["company.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_companysummary_summary_date"), "companysummary", ["summary_date"], unique=False)
    op.create_index(op.f("ix_companysummary_company_id"), "companysummary", ["company_id"], unique=False)


def downgrade() -> None:
    op.drop_table("companysummary")
    op.drop_table("riskevent")
    op.drop_table("risktopic")
    op.drop_table("company")
