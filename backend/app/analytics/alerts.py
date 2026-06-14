from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

from sqlmodel import Session, select

from app.logging import get_logger
from app.models import Company, IngestionStatus, RiskEvent, RiskTopic

logger = get_logger(__name__)


@dataclass
class AlertRule:
    company_id: int
    topic: str
    threshold_score: int
    notify_email: str


@dataclass
class TriggeredAlert:
    rule: AlertRule
    event: RiskEvent


class AlertEngine:
    def __init__(self, rules: list[AlertRule]) -> None:
        self._rules = rules

    def check(self, session: Session) -> list[TriggeredAlert]:
        cutoff = date.today() - timedelta(days=1)
        triggered: list[TriggeredAlert] = []

        for rule in self._rules:
            topic_row = session.exec(
                select(RiskTopic).where(RiskTopic.name == rule.topic)
            ).first()
            if topic_row is None:
                continue

            events = session.exec(
                select(RiskEvent).where(
                    RiskEvent.company_id == rule.company_id,
                    RiskEvent.topic_id == topic_row.id,
                    RiskEvent.status == IngestionStatus.published,
                    RiskEvent.risk_score >= rule.threshold_score,
                    RiskEvent.event_date >= cutoff,
                )
            ).all()

            for event in events:
                triggered.append(TriggeredAlert(rule=rule, event=event))

        return triggered

    def send(self, alert: TriggeredAlert, session: Optional[Session] = None) -> None:
        event = alert.event
        rule = alert.rule

        company_name = ""
        if session:
            company = session.get(Company, rule.company_id)
            company_name = company.name if company else str(rule.company_id)

        logger.warning(
            "ALERT triggered",
            company=company_name or str(rule.company_id),
            topic=rule.topic,
            risk_score=event.risk_score,
            threshold=rule.threshold_score,
            notify_email=rule.notify_email,
            event_title=event.title,
            evidence_excerpt=event.evidence_excerpt[:200],
            source_url=event.source_url,
        )
        # TODO: integrate real delivery (email via SES, Slack webhook, PagerDuty)
        # when deployment infrastructure is confirmed. Credentials should be
        # injected via environment variables, not hardcoded here.
