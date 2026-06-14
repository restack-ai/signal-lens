from datetime import date

import anthropic
from sqlmodel import Session, select

from app.config import settings
from app.extraction.prompts import SUMMARY_SYSTEM_PROMPT
from app.logging import get_logger
from app.models import Company, CompanySummary, IngestionStatus, RiskEvent

logger = get_logger(__name__)

_LOOKBACK_DAYS = 30


class CompanySummarizer:
    def __init__(self) -> None:
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def summarize(self, company: Company, events: list[RiskEvent]) -> str:
        if not events:
            return f"No published risk events found for {company.name} in the last {_LOOKBACK_DAYS} days."

        event_lines = "\n".join(
            f"- [{e.event_date}] {e.topic_id} | {e.severity} | score {e.risk_score} | "
            f"evidence: \"{e.evidence_excerpt[:200]}\""
            for e in events
        )
        user_content = (
            f"Company: {company.name} ({company.ticker})\n\n"
            f"Recent risk events (last {_LOOKBACK_DAYS} days):\n{event_lines}\n\n"
            "Write a 2–3 sentence risk summary with citations."
        )

        try:
            response = self._client.messages.create(
                model=settings.anthropic_summary_model,
                max_tokens=512,
                system=SUMMARY_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_content}],
            )
        except anthropic.APIError as exc:
            logger.error("Summary API error", company=company.name, error=str(exc))
            raise

        return response.content[0].text if response.content else ""

    def run_for_all_companies(self, session: Session) -> None:
        from datetime import timedelta

        cutoff = date.today() - timedelta(days=_LOOKBACK_DAYS)
        companies = session.exec(select(Company)).all()
        today = date.today()

        for company in companies:
            events = session.exec(
                select(RiskEvent).where(
                    RiskEvent.company_id == company.id,
                    RiskEvent.status == IngestionStatus.published,
                    RiskEvent.event_date >= cutoff,
                )
            ).all()

            try:
                summary_text = self.summarize(company, list(events))
            except Exception as exc:
                logger.error("Summarization failed", company=company.name, error=str(exc))
                continue

            avg_score = (
                round(sum(e.risk_score for e in events) / len(events)) if events else 0
            )

            # Upsert: replace today's summary if one already exists.
            existing = session.exec(
                select(CompanySummary).where(
                    CompanySummary.company_id == company.id,
                    CompanySummary.summary_date == today,
                )
            ).first()
            if existing:
                existing.summary = summary_text
                existing.risk_score = avg_score
                existing.model_name = settings.anthropic_summary_model
                session.add(existing)
            else:
                session.add(
                    CompanySummary(
                        company_id=company.id,
                        summary_date=today,
                        risk_score=avg_score,
                        summary=summary_text,
                        model_name=settings.anthropic_summary_model,
                    )
                )
            session.commit()
            logger.info("Summary upserted", company=company.name)
