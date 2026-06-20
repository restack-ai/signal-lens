"""Grounded risk copilot — retrieval + streaming answer over RiskEvents.

Phase 2 of the redesign. Retrieves the most relevant risk events (scoped to an
asset or the whole portfolio), then asks Claude to answer strictly from that
evidence with inline [n] citations. Streams the answer back as Server-Sent
Events so the frontend CopilotRail can render tokens as they arrive.

Retrieval is recency/severity ordered today; once embeddings are populated
(Phase 3) this is the natural place to switch to pgvector similarity.
"""
from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any

from sqlmodel import Session, select

from app.config import settings
from app.logging import get_logger
from app.models import Company, RiskEvent, RiskTopic

logger = get_logger(__name__)

_MOCK_INGESTION_SOURCE = "mock_seed"
_MAX_EVIDENCE = 8

SYSTEM_PROMPT = (
    "You are SignalLens, an equity risk-intelligence copilot. You answer questions "
    "about public-company risk using ONLY the numbered evidence provided in the user "
    "message — never outside knowledge. Cite the evidence you use with inline markers "
    "like [1] or [2]. If the evidence does not support an answer, say so plainly rather "
    "than speculating. Be concise and decision-oriented: 2-4 sentences, no preamble, "
    "lead with the conclusion. You are scoped to {context}."
)

USER_TEMPLATE = (
    "Question: {question}\n\n"
    "Evidence (scored risk events):\n{evidence}\n\n"
    "Answer the question using only this evidence, with [n] citations."
)


def _source_label(source_type: str) -> str:
    return "Company report" if source_type == "CompanyReport" else source_type


def retrieve_evidence(
    session: Session, ticker: str | None, limit: int = _MAX_EVIDENCE
) -> list[dict[str, Any]]:
    """Materialize the top evidence rows as plain dicts (no live DB session
    needed during streaming)."""
    query = (
        select(RiskEvent, Company, RiskTopic)
        .join(Company, RiskEvent.company_id == Company.id)
        .join(RiskTopic, RiskEvent.topic_id == RiskTopic.id)
    )
    if settings.real_ingestion_mode:
        query = query.where(RiskEvent.ingestion_source != _MOCK_INGESTION_SOURCE)
    if ticker:
        query = query.where(Company.ticker == ticker)
    query = query.order_by(
        RiskEvent.event_date.desc(), RiskEvent.risk_score.desc()
    ).limit(limit)

    rows = session.exec(query).all()
    return [
        {
            "id": event.id,
            "ticker": company.ticker,
            "company": company.name,
            "topic": topic.name,
            "source": _source_label(event.source_type),
            "date": event.event_date.isoformat() if event.event_date else "",
            "severity": event.severity,
            "score": event.exposure_score or event.risk_score,
            "title": event.title,
            "excerpt": event.evidence_excerpt,
        }
        for event, company, topic in rows
    ]


def _format_evidence(evidence: list[dict[str, Any]]) -> str:
    if not evidence:
        return "(no matching evidence found)"
    lines = []
    for i, e in enumerate(evidence, 1):
        lines.append(
            f"[{i}] {e['ticker']} · {e['source']} · {e['date']} · "
            f"{e['severity']} · score {e['score']}\n    {e['title']}: {e['excerpt']}"
        )
    return "\n".join(lines)


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def stream_copilot(
    question: str, context_label: str, evidence: list[dict[str, Any]]
) -> Iterator[str]:
    """Yield SSE frames: one citations frame, then token frames, then done.

    Frame shapes: {"type":"citations","items":[...]}, {"type":"token","text":...},
    {"type":"done"}, {"type":"error","message":...}.
    """
    yield _sse(
        {
            "type": "citations",
            "items": [
                {"id": e["id"], "source": e["source"], "title": e["title"]}
                for e in evidence
            ],
        }
    )

    if not settings.anthropic_api_key:
        notice = (
            "Live copilot answers need an Anthropic API key (set ANTHROPIC_API_KEY). "
            "The retrieved evidence is shown above for this scope."
        )
        for word in notice.split(" "):
            yield _sse({"type": "token", "text": word + " "})
        yield _sse({"type": "done"})
        return

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        with client.messages.stream(
            model=settings.anthropic_copilot_model,
            max_tokens=700,
            system=SYSTEM_PROMPT.format(context=context_label),
            messages=[
                {
                    "role": "user",
                    "content": USER_TEMPLATE.format(
                        question=question, evidence=_format_evidence(evidence)
                    ),
                }
            ],
        ) as stream:
            for text in stream.text_stream:
                yield _sse({"type": "token", "text": text})
        yield _sse({"type": "done"})
    except Exception as exc:  # noqa: BLE001 — surface any model/transport error to the UI
        logger.warning("copilot stream failed", error=str(exc))
        yield _sse({"type": "error", "message": "Copilot is unavailable right now."})
