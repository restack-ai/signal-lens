import os
from datetime import date, timedelta

from sqlmodel import Session, select

from app.database import engine, init_db
from app.models import Company, CompanySummary, RiskEvent, RiskSeverity, RiskTopic, SourceType


COMPANIES = [
    ("Tesla", "TSLA", "NASDAQ", "United States", "Automotive"),
    ("Apple", "AAPL", "NASDAQ", "United States", "Consumer Electronics"),
    ("Nvidia", "NVDA", "NASDAQ", "United States", "Semiconductors"),
    ("Microsoft", "MSFT", "NASDAQ", "United States", "Software"),
    ("Amazon", "AMZN", "NASDAQ", "United States", "Internet Retail"),
    ("Alphabet", "GOOGL", "NASDAQ", "United States", "Internet Services"),
    ("Meta", "META", "NASDAQ", "United States", "Social Platforms"),
    ("Boeing", "BA", "NYSE", "United States", "Aerospace"),
    ("Toyota", "TM", "NYSE", "Japan", "Automotive"),
    ("Samsung Electronics", "005930.KS", "KRX", "South Korea", "Semiconductors"),
]

TOPICS = [
    ("Regulation", "Government inquiries, policy shifts, sanctions, and compliance risk."),
    ("Litigation", "Lawsuits, settlements, class actions, and legal disputes."),
    ("Cybersecurity", "Breaches, vulnerabilities, ransomware, and data exposure."),
    ("Labor", "Union action, workforce disputes, hiring freezes, and safety incidents."),
    ("Supply Chain", "Supplier disruption, logistics delays, shortages, and concentration risk."),
    ("Climate", "Emissions, extreme weather, transition risk, and environmental compliance."),
    ("Accounting", "Financial controls, restatements, audits, and reporting integrity."),
    ("Product Safety", "Recalls, defects, failures, and customer safety concerns."),
    ("Management", "Executive changes, governance, culture, and strategic execution."),
    ("Geopolitics", "Trade controls, regional conflict, tariffs, and cross-border exposure."),
]

EVENT_TEMPLATES = [
    {
        "title": "Regulatory scrutiny expands for {name}",
        "topic": "Regulation",
        "severity": "high",
        "score": 82,
        "source_type": SourceType.SEC,
        "source_name": "Seeded SEC Risk Extract",
        "excerpt": "The company disclosed expanded regulatory requests and additional compliance review activity in a seeded filing excerpt.",
        "driver": "Regulatory review is the primary driver because repeated seeded disclosures point to higher compliance burden and possible operating constraints.",
        "action": "Review recent 10-K and 10-Q risk factor language for changes in regulatory exposure.",
    },
    {
        "title": "Supplier bottleneck pressures {name} production plans",
        "topic": "Supply Chain",
        "severity": "medium",
        "score": 64,
        "source_type": SourceType.RSS,
        "source_name": "Seeded Industry RSS Brief",
        "excerpt": "Seeded supplier coverage describes component availability pressure and longer lead times affecting production planning.",
        "driver": "Supply chain pressure contributes to risk through delayed capacity plans and concentration in key suppliers.",
        "action": "Compare supplier concentration, inventory commentary, and production guidance across peers.",
    },
    {
        "title": "New litigation filing names {name}",
        "topic": "Litigation",
        "severity": "medium",
        "score": 58,
        "source_type": SourceType.Web,
        "source_name": "Seeded Court Watch",
        "excerpt": "A seeded legal item cites a new complaint naming the company and requesting damages and injunctive relief.",
        "driver": "Litigation risk is rising because a new seeded matter could create legal cost and disclosure pressure.",
        "action": "Track docket milestones and compare the matter against disclosed legal contingencies.",
    },
    {
        "title": "Cyber risk bulletin flags vendor exposure at {name}",
        "topic": "Cybersecurity",
        "severity": "high",
        "score": 76,
        "source_type": SourceType.Web,
        "source_name": "Seeded Cyber Advisory",
        "excerpt": "The seeded bulletin references third-party access paths and possible downstream exposure for enterprise customers.",
        "driver": "Cybersecurity risk is material because vendor exposure can propagate across operations and customer trust.",
        "action": "Review security incident disclosures, vendor dependencies, and remediation statements.",
    },
    {
        "title": "Product safety review opened for {name}",
        "topic": "Product Safety",
        "severity": "high",
        "score": 79,
        "source_type": SourceType.GDELT,
        "source_name": "Seeded Safety Monitor",
        "excerpt": "Seeded public coverage describes a product safety review following customer reports and regulator questions.",
        "driver": "Product safety is a strong driver because reviews can lead to recalls, warranty costs, and reputation impact.",
        "action": "Check recall databases, warranty accrual commentary, and product incident trend data.",
    },
    {
        "title": "Management transition raises execution questions at {name}",
        "topic": "Management",
        "severity": "medium",
        "score": 61,
        "source_type": SourceType.CompanyReport,
        "source_name": "Seeded Company Report",
        "excerpt": "A seeded company update notes leadership changes in a business unit tied to strategic execution.",
        "driver": "Management transition contributes to risk when execution ownership changes during active operating pressure.",
        "action": "Review leadership tenure, segment performance, and guidance revisions after the transition.",
    },
    {
        "title": "Climate reporting expectations tighten for {name}",
        "topic": "Climate",
        "severity": "low",
        "score": 42,
        "source_type": SourceType.RSS,
        "source_name": "Seeded Climate Policy Feed",
        "excerpt": "Seeded policy coverage describes tighter emissions reporting expectations for companies in exposed sectors.",
        "driver": "Climate risk is currently lower but creates reporting and transition-cost follow-up requirements.",
        "action": "Compare emissions disclosures, transition plans, and regulatory exposure by geography.",
    },
    {
        "title": "Labor negotiations intensify around {name} facilities",
        "topic": "Labor",
        "severity": "medium",
        "score": 67,
        "source_type": SourceType.Web,
        "source_name": "Seeded Labor News",
        "excerpt": "Seeded local coverage describes intensified negotiations, worker demands, and possible facility disruption.",
        "driver": "Labor risk is increasing because negotiations could affect productivity, cost structure, and delivery timing.",
        "action": "Monitor negotiation deadlines, union statements, and site-level operating exposure.",
    },
    {
        "title": "Accounting control review noted for {name}",
        "topic": "Accounting",
        "severity": "medium",
        "score": 55,
        "source_type": SourceType.SEC,
        "source_name": "Seeded Filing Review",
        "excerpt": "Seeded filing language references internal-control review activity and financial reporting process remediation.",
        "driver": "Accounting risk is a driver when controls language suggests reporting quality should be monitored.",
        "action": "Inspect auditor language, material weakness disclosures, and remediation timelines.",
    },
    {
        "title": "Geopolitical trade restrictions affect {name} outlook",
        "topic": "Geopolitics",
        "severity": "high",
        "score": 73,
        "source_type": SourceType.GDELT,
        "source_name": "Seeded Trade Monitor",
        "excerpt": "Seeded cross-border coverage describes tighter trade restrictions and possible demand or supply impacts.",
        "driver": "Geopolitical exposure is material where trade controls affect revenue access or component sourcing.",
        "action": "Map revenue and supplier exposure by restricted geography and monitor policy updates.",
    },
]


def seed() -> None:
    init_db()

    with Session(engine) as session:
        # Topics: insert only missing ones, keyed by name.
        existing_topic_names = set(
            session.exec(select(RiskTopic.name)).all()
        )
        topics: dict[str, RiskTopic] = {}
        for name, description in TOPICS:
            if name not in existing_topic_names:
                topic = RiskTopic(name=name, description=description)
                session.add(topic)
                topics[name] = topic
            else:
                topics[name] = session.exec(
                    select(RiskTopic).where(RiskTopic.name == name)
                ).one()
        session.commit()
        # Refresh to ensure all topics have IDs.
        for topic in topics.values():
            session.refresh(topic)

        # Companies: insert only missing ones, keyed by ticker.
        existing_tickers = set(session.exec(select(Company.ticker)).all())
        companies: list[Company] = []
        for name, ticker, exchange, country, sector in COMPANIES:
            if ticker not in existing_tickers:
                company = Company(
                    name=name,
                    ticker=ticker,
                    exchange=exchange,
                    country=country,
                    sector=sector,
                    watchlist=True,
                )
                session.add(company)
                companies.append(company)
            else:
                companies.append(
                    session.exec(select(Company).where(Company.ticker == ticker)).one()
                )
        session.commit()
        for company in companies:
            session.refresh(company)

        today = date.today()
        for company_index, company in enumerate(companies):
            company_score_total = 0
            for event_index in range(5):
                template_index = (company_index + event_index) % len(EVENT_TEMPLATES)
                template = EVENT_TEMPLATES[template_index]
                topic_name = template["topic"]
                severity = template["severity"]
                base_score = template["score"]
                score = min(96, max(20, base_score + ((company_index * 7 + event_index * 5) % 13) - 6))
                confidence = round(0.72 + ((company_index + event_index) % 4) * 0.06, 2)
                company_score_total += score

                event_date = today - timedelta(days=company_index * 2 + event_index * 6)
                source_url = (
                    f"https://example.com/seeded-mock-risk/{company.ticker.lower()}/"
                    f"{topic_name.lower().replace(' ', '-')}-{event_index}"
                )

                # Skip if this seeded event already exists (same company + url).
                existing = session.exec(
                    select(RiskEvent).where(
                        RiskEvent.company_id == company.id,
                        RiskEvent.source_url == source_url,
                    )
                ).first()
                if existing:
                    continue

                event = RiskEvent(
                    company_id=company.id,
                    topic_id=topics[topic_name].id,
                    title=template["title"].format(name=company.name),
                    source_type=template["source_type"],
                    source_name=template["source_name"],
                    source_url=source_url,
                    event_date=event_date,
                    severity=RiskSeverity(severity),
                    confidence=confidence,
                    risk_score=score,
                    exposure_score=score,
                    summary=f"Seeded mock signal indicates {topic_name.lower()} risk for {company.name}. This is not real public-source coverage.",
                    evidence_excerpt=template["excerpt"].replace("The company", company.name),
                    risk_driver_summary=template["driver"],
                    suggested_action=template["action"],
                    raw_text=f"{company.name} seeded mock public risk item covering {topic_name}. Evidence excerpt: {template['excerpt']}",
                )
                session.add(event)

            # Upsert summary: add only if none exists for today.
            avg_score = round(company_score_total / 5)
            existing_summary = session.exec(
                select(CompanySummary).where(
                    CompanySummary.company_id == company.id,
                    CompanySummary.summary_date == today,
                )
            ).first()
            if not existing_summary:
                session.add(
                    CompanySummary(
                        company_id=company.id,
                        summary_date=today,
                        risk_score=avg_score,
                        summary=f"{company.name} shows a seeded risk profile with elevated attention around public signals and recent mock events.",
                    )
                )
        session.commit()


if __name__ == "__main__":
    # Respect SEED_ON_START so this module is safe to import anywhere; the
    # __main__ block only runs when explicitly invoked or when the env var
    # is truthy (docker-compose dev command calls `python -m app.seed`).
    seed_flag = os.environ.get("SEED_ON_START", "true").lower()
    if seed_flag in ("1", "true", "yes"):
        seed()
    else:
        print("SEED_ON_START is not enabled; skipping seed.")
