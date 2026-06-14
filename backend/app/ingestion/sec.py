import time
from datetime import date, timedelta
from typing import Optional

import httpx

from app.logging import get_logger

logger = get_logger(__name__)

_USER_AGENT = "SignalLens/1.0 (contact@signallens.com)"
_EDGAR_SEARCH = "https://efts.sec.gov/LATEST/search-index"
_MIN_INTERVAL = 0.1  # SEC rate limit: max 10 req/sec


class SECIngester:
    def __init__(self) -> None:
        self._client = httpx.Client(
            headers={"User-Agent": _USER_AGENT, "Accept": "application/json"},
            timeout=30.0,
        )
        self._last_request_at: float = 0.0

    def _rate_limit(self) -> None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < _MIN_INTERVAL:
            time.sleep(_MIN_INTERVAL - elapsed)
        self._last_request_at = time.monotonic()

    def fetch_recent_filings(
        self,
        ticker: str,
        form_types: Optional[list[str]] = None,
        days_back: int = 7,
    ) -> list[dict]:
        if form_types is None:
            form_types = ["8-K", "10-K"]

        end_date = date.today()
        start_date = end_date - timedelta(days=days_back)
        results: list[dict] = []

        for form_type in form_types:
            self._rate_limit()
            params = {
                "q": ticker,
                "dateRange": "custom",
                "startdt": start_date.isoformat(),
                "enddt": end_date.isoformat(),
                "forms": form_type,
                "_source": "hits.hits._source.period_of_report,hits.hits._source.entity_name,hits.hits._source.file_date,hits.hits._source.form_type,hits.hits._id",
            }
            try:
                response = self._client.get(_EDGAR_SEARCH, params=params)
                response.raise_for_status()
                data = response.json()
            except Exception as exc:
                logger.warning("SEC EDGAR request failed", ticker=ticker, form=form_type, error=str(exc))
                continue

            hits = data.get("hits", {}).get("hits", [])
            for hit in hits:
                source = hit.get("_source", {})
                doc_id = hit.get("_id", "")
                filing_url = f"https://www.sec.gov/Archives/edgar/data/{doc_id}" if doc_id else ""
                results.append(
                    {
                        "title": f"{source.get('form_type', form_type)} filing: {source.get('entity_name', ticker)}",
                        "url": filing_url,
                        "filed_at": source.get("file_date", ""),
                        "form_type": source.get("form_type", form_type),
                        "company_name": source.get("entity_name", ticker),
                        "cik": doc_id,
                    }
                )
        return results

    def fetch_filing_text(self, url: str) -> str:
        self._rate_limit()
        try:
            response = self._client.get(url)
            response.raise_for_status()
            raw = response.text
        except Exception as exc:
            logger.warning("Failed to fetch filing text", url=url, error=str(exc))
            return ""

        # Strip HTML tags without requiring an external parser dependency.
        import re

        text = re.sub(r"<[^>]+>", " ", raw)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def close(self) -> None:
        self._client.close()
