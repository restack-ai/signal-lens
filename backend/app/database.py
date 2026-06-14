from collections.abc import Generator

from sqlalchemy import text
from sqlmodel import Session, create_engine

from app.config import settings


engine = create_engine(
    settings.database_url,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)


def init_db() -> None:
    # Schema is managed by Alembic migrations; only the extension needs to be
    # created imperatively because it requires superuser and cannot live in a
    # migration that runs as the app user in all environments.
    with engine.connect() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        connection.commit()


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
