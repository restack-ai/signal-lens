"""Add ingestion fields and eventsource table

Revision ID: 0002
Revises: 0001
Create Date: 2026-01-02 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add ingestion fields to riskevent; default published to preserve backward
    # compatibility with all seeded rows which are already published.
    op.add_column(
        "riskevent",
        sa.Column("status", sa.String(), nullable=False, server_default="published"),
    )
    op.add_column("riskevent", sa.Column("fetched_at", sa.DateTime(), nullable=True))
    op.add_column("riskevent", sa.Column("content_hash", sa.String(), nullable=True))

    op.create_index(op.f("ix_riskevent_status"), "riskevent", ["status"], unique=False)
    op.create_index(op.f("ix_riskevent_fetched_at"), "riskevent", ["fetched_at"], unique=False)
    op.create_index(op.f("ix_riskevent_content_hash"), "riskevent", ["content_hash"], unique=False)

    op.create_table(
        "eventsource",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("source_type", sa.String(), nullable=False),
        sa.Column("source_name", sa.String(), nullable=False),
        sa.Column("source_url", sa.String(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(), nullable=False),
        sa.Column("raw_payload_key", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["riskevent.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_eventsource_event_id"), "eventsource", ["event_id"], unique=False)


def downgrade() -> None:
    op.drop_table("eventsource")
    op.drop_index(op.f("ix_riskevent_content_hash"), table_name="riskevent")
    op.drop_index(op.f("ix_riskevent_fetched_at"), table_name="riskevent")
    op.drop_index(op.f("ix_riskevent_status"), table_name="riskevent")
    op.drop_column("riskevent", "content_hash")
    op.drop_column("riskevent", "fetched_at")
    op.drop_column("riskevent", "status")
