import hashlib

from sqlmodel import Session, select

from app.models import RiskEvent


def compute_content_hash(title: str, source_url: str) -> str:
    raw = f"{title}|{source_url}"
    return hashlib.sha256(raw.encode()).hexdigest()


def is_duplicate(session: Session, content_hash: str) -> bool:
    existing = session.exec(
        select(RiskEvent).where(RiskEvent.content_hash == content_hash)
    ).first()
    return existing is not None
