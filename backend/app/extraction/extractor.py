from dataclasses import dataclass, field
from typing import Optional

import anthropic
import httpx

from app.config import settings
from app.extraction.prompts import EXTRACTION_TOOL, SYSTEM_PROMPT
from app.logging import get_logger

logger = get_logger(__name__)

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
                model=settings.anthropic_extraction_model,
                max_tokens=4096,
                system=system_message,  # type: ignore[arg-type]
                tools=[EXTRACTION_TOOL],
                tool_choice={"type": "auto"},
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
        if not settings.openai_api_key:
            logger.info("OpenAI API key not configured; skipping embedding generation")
            return []

        input_text = text[:20_000] if len(text) > 20_000 else text
        try:
            response = httpx.post(
                "https://api.openai.com/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={"model": settings.openai_embedding_model, "input": input_text},
                timeout=30,
            )
            response.raise_for_status()
            payload = response.json()
            embedding = payload["data"][0]["embedding"]
            return [float(value) for value in embedding]
        except Exception as exc:
            logger.error(
                "Embedding generation failed",
                model=settings.openai_embedding_model,
                error=str(exc),
            )
            return []
