from typing import Optional

from sqlmodel import Session, select

from app.models import Company


class EntityMatcher:
    """Maps raw text mentions to Company rows.

    Built once from the DB at startup; callers should reconstruct if the
    company list changes at runtime.
    """

    def __init__(self, session: Session) -> None:
        companies = session.exec(select(Company)).all()
        self._ticker_index: dict[str, int] = {}
        self._name_index: dict[str, int] = {}
        for company in companies:
            self._ticker_index[company.ticker.upper()] = company.id
            self._name_index[company.name.lower()] = company.id

    def match(self, mention: str) -> Optional[tuple[int, float]]:
        upper = mention.strip().upper()
        if upper in self._ticker_index:
            return self._ticker_index[upper], 1.0

        lower = mention.strip().lower()
        if lower in self._name_index:
            return self._name_index[lower], 1.0

        # Substring match — checks if the mention contains a known company name.
        for name, company_id in self._name_index.items():
            if name in lower or lower in name:
                return company_id, 0.85

        return None
