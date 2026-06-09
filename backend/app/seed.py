from datetime import date, timedelta

from sqlmodel import Session, delete, select

from app.database import engine, init_db
from app.models import Company, CompanySummary, RiskEvent, RiskSeverity, RiskTopic


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
    ("Regulatory scrutiny expands for {name}", "Regulation", "high", 82),
    ("Supplier bottleneck pressures {name} production plans", "Supply Chain", "medium", 64),
    ("New litigation filing names {name}", "Litigation", "medium", 58),
    ("Cyber risk bulletin flags vendor exposure at {name}", "Cybersecurity", "high", 76),
    ("Product safety review opened for {name}", "Product Safety", "high", 79),
    ("Management transition raises execution questions at {name}", "Management", "medium", 61),
    ("Climate reporting expectations tighten for {name}", "Climate", "low", 42),
    ("Labor negotiations intensify around {name} facilities", "Labor", "medium", 67),
    ("Accounting control review noted for {name}", "Accounting", "medium", 55),
    ("Geopolitical trade restrictions affect {name} outlook", "Geopolitics", "high", 73),
]


def reset_data(session: Session) -> None:
    session.exec(delete(CompanySummary))
    session.exec(delete(RiskEvent))
    session.exec(delete(RiskTopic))
    session.exec(delete(Company))
    session.commit()


def seed() -> None:
    init_db()
    with Session(engine) as session:
        existing = session.exec(select(Company)).first()
        if existing:
            reset_data(session)

        topics = {
            name: RiskTopic(name=name, description=description)
            for name, description in TOPICS
        }
        session.add_all(topics.values())
        session.commit()

        companies: list[Company] = []
        for name, ticker, exchange, country, sector in COMPANIES:
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
        session.commit()

        today = date.today()
        for company_index, company in enumerate(companies):
            company_score_total = 0
            for event_index in range(5):
                template_index = (company_index + event_index) % len(EVENT_TEMPLATES)
                title_template, topic_name, severity, base_score = EVENT_TEMPLATES[template_index]
                score = min(96, max(20, base_score + ((company_index * 7 + event_index * 5) % 13) - 6))
                company_score_total += score
                event = RiskEvent(
                    company_id=company.id,
                    topic_id=topics[topic_name].id,
                    title=title_template.format(name=company.name),
                    source_name="SignalLens Mock Feed",
                    source_url=f"https://example.com/mock/{company.ticker.lower()}/{event_index}",
                    event_date=today - timedelta(days=company_index * 2 + event_index * 6),
                    severity=RiskSeverity(severity),
                    confidence=round(0.72 + ((company_index + event_index) % 4) * 0.06, 2),
                    risk_score=score,
                    summary=f"Mock signal indicates {topic_name.lower()} risk for {company.name}. The item is seeded data for dashboard development.",
                    raw_text=f"{company.name} mock public risk item covering {topic_name}.",
                )
                session.add(event)

            avg_score = round(company_score_total / 5)
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
    seed()
