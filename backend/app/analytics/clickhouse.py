from typing import Optional

from app.config import settings
from app.logging import get_logger
from app.models import RiskEvent

logger = get_logger(__name__)


def get_client() -> Optional[object]:
    if not settings.clickhouse_url:
        return None
    try:
        import clickhouse_connect

        return clickhouse_connect.get_client(dsn=settings.clickhouse_url)
    except Exception as exc:
        logger.warning("ClickHouse connection failed", error=str(exc))
        return None


class ClickHouseClient:
    def __init__(self) -> None:
        self._client = get_client()

    @property
    def available(self) -> bool:
        return self._client is not None

    def sync_events(self, events: list[RiskEvent]) -> None:
        if not self.available:
            logger.debug("ClickHouse not configured; skipping sync")
            return

        rows = [
            [
                e.id,
                e.company_id,
                e.topic_id,
                str(e.event_date),
                e.severity.value,
                e.risk_score,
                e.exposure_score,
                e.confidence,
                e.source_type.value,
                e.status.value,
                str(e.extracted_at),
            ]
            for e in events
        ]
        column_names = [
            "id", "company_id", "topic_id", "event_date", "severity",
            "risk_score", "exposure_score", "confidence", "source_type",
            "status", "extracted_at",
        ]
        try:
            self._client.insert("risk_events", rows, column_names=column_names)  # type: ignore[union-attr]
        except Exception as exc:
            logger.error("ClickHouse insert failed", error=str(exc))

    def query_exposure_trend(self, company: str, days: int = 90) -> list[dict]:
        if not self.available:
            return []
        try:
            result = self._client.query(  # type: ignore[union-attr]
                f"""
                SELECT
                    toDate(event_date) AS date,
                    avg(risk_score) AS avg_score,
                    count() AS event_count
                FROM risk_events
                WHERE company_id IN (
                    SELECT id FROM company WHERE name = %(company)s
                )
                AND event_date >= today() - INTERVAL %(days)s DAY
                GROUP BY date
                ORDER BY date
                """,
                parameters={"company": company, "days": days},
            )
            return [
                {"date": str(row[0]), "avg_score": float(row[1]), "event_count": int(row[2])}
                for row in result.result_rows
            ]
        except Exception as exc:
            logger.error("ClickHouse query failed", error=str(exc))
            return []
