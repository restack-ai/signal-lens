from datetime import date, timedelta
from email.message import EmailMessage
import smtplib
from typing import Optional

import httpx
from sqlmodel import Session, select

from app.config import settings
from app.logging import get_logger
from app.models import AlertRule, Company, IngestionStatus, RiskEvent, RiskTopic

logger = get_logger(__name__)


class TriggeredAlert:
    def __init__(self, rule: AlertRule, event: RiskEvent) -> None:
        self.rule = rule
        self.event = event


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
        self._send_email(alert, company_name)
        self._send_webhook(alert, company_name)

    def _alert_subject(self, alert: TriggeredAlert, company_name: str) -> str:
        return (
            f"SignalLens alert: {company_name or alert.rule.company_id} "
            f"{alert.rule.topic} score {alert.event.risk_score}"
        )

    def _alert_body(self, alert: TriggeredAlert, company_name: str) -> str:
        event = alert.event
        rule = alert.rule
        return (
            f"Company: {company_name or rule.company_id}\n"
            f"Topic: {rule.topic}\n"
            f"Risk score: {event.risk_score} (threshold {rule.threshold_score})\n"
            f"Title: {event.title}\n"
            f"Evidence: {event.evidence_excerpt[:500]}\n"
            f"Source: {event.source_url}\n"
        )

    def _send_email(self, alert: TriggeredAlert, company_name: str) -> None:
        if not settings.smtp_host:
            logger.info(
                "SMTP not configured; email alert logged only",
                notify_email=alert.rule.notify_email,
                event_id=alert.event.id,
            )
            return

        message = EmailMessage()
        message["From"] = settings.alert_from_email
        message["To"] = alert.rule.notify_email
        message["Subject"] = self._alert_subject(alert, company_name)
        message.set_content(self._alert_body(alert, company_name))

        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                if settings.smtp_use_tls:
                    smtp.starttls()
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(message)
        except Exception as exc:
            logger.error(
                "Email alert delivery failed",
                notify_email=alert.rule.notify_email,
                event_id=alert.event.id,
                error=str(exc),
            )

    def _send_webhook(self, alert: TriggeredAlert, company_name: str) -> None:
        webhook_url = alert.rule.webhook_url or settings.alert_webhook_url
        if not webhook_url:
            return

        payload = {
            "company": company_name or str(alert.rule.company_id),
            "company_id": alert.rule.company_id,
            "topic": alert.rule.topic,
            "threshold_score": alert.rule.threshold_score,
            "event_id": alert.event.id,
            "event_title": alert.event.title,
            "risk_score": alert.event.risk_score,
            "severity": alert.event.severity.value,
            "evidence_excerpt": alert.event.evidence_excerpt,
            "source_url": alert.event.source_url,
        }
        try:
            with httpx.Client(timeout=10) as client:
                response = client.post(webhook_url, json=payload)
                response.raise_for_status()
        except Exception as exc:
            logger.error(
                "Webhook alert delivery failed",
                webhook_url=webhook_url,
                event_id=alert.event.id,
                error=str(exc),
            )
