"""Apply security, retry limits, alerting rules and database indexing improvements

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
    # Add retry_count and error_message to riskevent
    op.add_column("riskevent", sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("riskevent", sa.Column("error_message", sa.Text(), nullable=True))
    op.create_index(op.f("ix_riskevent_retry_count"), "riskevent", ["retry_count"], unique=False)

    # Add index on tenantwatchlist.company_id
    op.create_index(op.f("ix_tenantwatchlist_company_id"), "tenantwatchlist", ["company_id"], unique=False)

    # Create alertrule table
    op.create_table(
        "alertrule",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("topic", sa.String(), nullable=False),
        sa.Column("threshold_score", sa.Integer(), nullable=False),
        sa.Column("notify_email", sa.String(), nullable=False),
        sa.Column("webhook_url", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["company.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenant.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_alertrule_tenant_id"), "alertrule", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_alertrule_company_id"), "alertrule", ["company_id"], unique=False)
    op.create_index(op.f("ix_alertrule_topic"), "alertrule", ["topic"], unique=False)
    op.create_index(op.f("ix_alertrule_is_active"), "alertrule", ["is_active"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_alertrule_is_active"), table_name="alertrule")
    op.drop_index(op.f("ix_alertrule_topic"), table_name="alertrule")
    op.drop_index(op.f("ix_alertrule_company_id"), table_name="alertrule")
    op.drop_index(op.f("ix_alertrule_tenant_id"), table_name="alertrule")
    op.drop_table("alertrule")

    op.drop_index(op.f("ix_tenantwatchlist_company_id"), table_name="tenantwatchlist")

    op.drop_index(op.f("ix_riskevent_retry_count"), table_name="riskevent")
    op.drop_column("riskevent", "error_message")
    op.drop_column("riskevent", "retry_count")
