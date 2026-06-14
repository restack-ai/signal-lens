"""Offline evaluation harness for the risk extractor.

Run with:
    python -m app.extraction.eval
"""

from dataclasses import dataclass, field
from typing import Optional

from app.extraction.extractor import ExtractionResult, RiskExtractor


@dataclass
class EvalExample:
    raw_text: str
    company_name: str
    expected_topic: str
    expected_severity: str
    expected_confidence_min: float
    source_type: str = "SEC"


@dataclass
class EvalReport:
    total: int
    topic_correct: int
    severity_correct: int
    confidence_met: int
    precision_by_topic: dict[str, float] = field(default_factory=dict)
    recall_by_topic: dict[str, float] = field(default_factory=dict)

    def print(self) -> None:
        print(f"\n=== Eval Report ({self.total} examples) ===")
        print(f"Topic accuracy:      {self.topic_correct}/{self.total}")
        print(f"Severity accuracy:   {self.severity_correct}/{self.total}")
        print(f"Confidence met:      {self.confidence_met}/{self.total}")
        if self.precision_by_topic:
            print("\nPrecision by topic:")
            for topic, score in sorted(self.precision_by_topic.items()):
                print(f"  {topic:<20} {score:.2f}")


SAMPLE_EVAL_SET: list[EvalExample] = [
    EvalExample(
        raw_text=(
            "The Company is subject to a formal investigation by the Securities and Exchange "
            "Commission relating to its accounting practices for revenue recognition. The "
            "investigation was disclosed in an 8-K filed on March 15, 2024."
        ),
        company_name="Acme Corp",
        expected_topic="Accounting",
        expected_severity="high",
        expected_confidence_min=0.8,
    ),
    EvalExample(
        raw_text=(
            "On February 1, 2024, a class action lawsuit was filed against the Company alleging "
            "violations of the Securities Exchange Act of 1934. The plaintiffs seek unspecified "
            "damages and injunctive relief."
        ),
        company_name="Acme Corp",
        expected_topic="Litigation",
        expected_severity="medium",
        expected_confidence_min=0.75,
    ),
    EvalExample(
        raw_text=(
            "The Company detected unauthorized access to its customer data systems in January 2024. "
            "Approximately 2.3 million customer records may have been exposed. The Company has "
            "notified affected customers and relevant regulators as required."
        ),
        company_name="Acme Corp",
        expected_topic="Cybersecurity",
        expected_severity="high",
        expected_confidence_min=0.85,
    ),
    EvalExample(
        raw_text=(
            "Workers at three of the Company's manufacturing facilities have voted to authorize a "
            "strike effective April 1, 2024, following the breakdown of contract negotiations. "
            "The Company estimates a potential production impact of 15% if the strike proceeds."
        ),
        company_name="Acme Corp",
        expected_topic="Labor",
        expected_severity="high",
        expected_confidence_min=0.8,
    ),
    EvalExample(
        raw_text=(
            "The Company has identified a key component shortage affecting its primary product line "
            "due to disruptions at a sole-source supplier in Southeast Asia. Lead times have "
            "extended from 8 weeks to 26 weeks."
        ),
        company_name="Acme Corp",
        expected_topic="Supply Chain",
        expected_severity="high",
        expected_confidence_min=0.8,
    ),
    EvalExample(
        raw_text=(
            "New EPA regulations effective January 2025 will require the Company to reduce "
            "greenhouse gas emissions by 40% from 2019 baseline levels. Capital expenditure "
            "to comply is estimated at $120 million."
        ),
        company_name="Acme Corp",
        expected_topic="Climate",
        expected_severity="medium",
        expected_confidence_min=0.75,
    ),
    EvalExample(
        raw_text=(
            "The Company's Chief Executive Officer resigned effective March 31, 2024. The Board "
            "has appointed an interim CEO while a search for a permanent replacement is underway."
        ),
        company_name="Acme Corp",
        expected_topic="Management",
        expected_severity="medium",
        expected_confidence_min=0.7,
    ),
]


def run_eval(
    extractor: RiskExtractor,
    eval_set: Optional[list[EvalExample]] = None,
) -> EvalReport:
    if eval_set is None:
        eval_set = SAMPLE_EVAL_SET

    topic_correct = 0
    severity_correct = 0
    confidence_met = 0
    topic_hits: dict[str, int] = {}
    topic_total: dict[str, int] = {}

    for example in eval_set:
        topic_total[example.expected_topic] = topic_total.get(example.expected_topic, 0) + 1
        try:
            results = extractor.extract(
                raw_text=example.raw_text,
                company_name=example.company_name,
                source_type=example.source_type,
            )
        except Exception as exc:
            print(f"  [ERROR] {example.expected_topic}: {exc}")
            continue

        best: Optional[ExtractionResult] = None
        for r in results:
            if r.topic == example.expected_topic:
                best = r
                break
        if best is None and results:
            best = results[0]

        if best is not None:
            if best.topic == example.expected_topic:
                topic_correct += 1
                topic_hits[example.expected_topic] = topic_hits.get(example.expected_topic, 0) + 1
            if best.severity == example.expected_severity:
                severity_correct += 1
            if best.confidence >= example.expected_confidence_min:
                confidence_met += 1

    precision_by_topic = {
        topic: topic_hits.get(topic, 0) / count
        for topic, count in topic_total.items()
    }

    return EvalReport(
        total=len(eval_set),
        topic_correct=topic_correct,
        severity_correct=severity_correct,
        confidence_met=confidence_met,
        precision_by_topic=precision_by_topic,
    )


if __name__ == "__main__":
    extractor = RiskExtractor()
    report = run_eval(extractor)
    report.print()
