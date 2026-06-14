"""Replace text embedding column with real pgvector Vector column

Revision ID: 0003
Revises: 0002
Create Date: 2026-01-03 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Drop the text placeholder and replace with a proper vector column.
    # Existing NULL values are preserved by making the new column nullable.
    op.drop_column("riskevent", "embedding")

    # Use raw SQL so this migration doesn't require the pgvector Python package
    # at migration time — only the Postgres extension is required.
    op.execute("ALTER TABLE riskevent ADD COLUMN embedding vector(1536)")

    op.execute(
        "CREATE INDEX IF NOT EXISTS riskevent_embedding_idx "
        "ON riskevent USING ivfflat (embedding vector_cosine_ops) "
        "WITH (lists = 100)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS riskevent_embedding_idx")
    op.execute("ALTER TABLE riskevent DROP COLUMN IF EXISTS embedding")
    op.add_column("riskevent", sa.Column("embedding", sa.Text(), nullable=True))
