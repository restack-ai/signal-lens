from dataclasses import dataclass, field
from typing import Optional

import anthropic

from app.config import settings
from app.extraction.prompts import EXTRACTION_TOOL, SYSTEM_PROMPT
from app.logging import get_logger

logger = get_logger(__name__)

_EXTRACTION_MODEL = "claude-sonnet-4-6"


@dataclass
class ExtractionResult:
    topic: str
    topic_label: str
    severity: str
    risk_score: int
    confidence: float
    evidence_excerpt: str
    evidence_char_start: int
    evidence_char_end: int
    risk_driver_summary: str
    suggested_action: str
    title: str
    embedding: list[float] = field(default_factory=list)


class RiskExtractor:
    def __init__(self) -> None:
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def extract(
        self, raw_text: str, company_name: str, source_type: str
    ) -> list[ExtractionResult]:
        # Truncate very long documents to avoid token limits; extraction quality
        # degrades beyond ~50 k characters regardless.
        text = raw_text[:50_000] if len(raw_text) > 50_000 else raw_text

        system_message = [
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                # Cache the system prompt + taxonomy for all calls in the same
                # session to avoid re-tokenising on every document.
                "cache_control": {"type": "ephemeral"},
            }
        ]

        user_content = (
            f"Company: {company_name}\nSource type: {source_type}\n\n"
            f"--- BEGIN SOURCE TEXT ---\n{text}\n--- END SOURCE TEXT ---\n\n"
            "Extract all material risk events from the text above."
        )

        try:
            response = self._client.messages.create(
                model=_EXTRACTION_MODEL,
                max_tokens=4096,
                system=system_message,  # type: ignore[arg-type]
                tools=[EXTRACTION_TOOL],
                tool_choice={"type": "any"},
                messages=[{"role": "user", "content": user_content}],
            )
        except anthropic.APIError as exc:
            logger.error("Anthropic API error during extraction", company=company_name, error=str(exc))
            raise

        usage = response.usage
        logger.info(
            "Extraction complete",
            company=company_name,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
        )

        results: list[ExtractionResult] = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            inp = block.input
            results.append(
                ExtractionResult(
                    topic=inp["topic"],
                    topic_label=inp["topic_label"],
                    severity=inp["severity"],
                    risk_score=int(inp["risk_score"]),
                    confidence=float(inp["confidence"]),
                    evidence_excerpt=inp["evidence_excerpt"],
                    evidence_char_start=int(inp["evidence_char_start"]),
                    evidence_char_end=int(inp["evidence_char_end"]),
                    risk_driver_summary=inp["risk_driver_summary"],
                    suggested_action=inp["suggested_action"],
                    title=inp["title"],
                )
            )

        if not results:
            logger.warning("No risk events extracted", company=company_name)

        return results

    def embed(self, text: str) -> list[float]:
        # TODO: replace with a real embedding model (Cohere embed-v3, OpenAI
        # text-embedding-3-small, or a local model). Anthropic does not offer
        # a dedicated embeddings API. The infrastructure (pgvector column +
        # migration) is in place; swap this stub when the model is chosen.
        return [0.0] * 1536
