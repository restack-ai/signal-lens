"""Add retry accounting for extraction failures

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-14 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "riskevent",
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("riskevent", sa.Column("error_message", sa.Text(), nullable=True))
    op.create_index(
        op.f("ix_riskevent_retry_count"),
        "riskevent",
        ["retry_count"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_riskevent_retry_count"), table_name="riskevent")
    op.drop_column("riskevent", "error_message")
    op.drop_column("riskevent", "retry_count")
