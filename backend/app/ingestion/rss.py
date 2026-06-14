from datetime import datetime, timezone
from typing import Optional

import feedparser

from app.logging import get_logger

logger = get_logger(__name__)

DEFAULT_FEEDS: dict[str, list[str]] = {
    ticker: [f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"]
    for ticker in [
        "TSLA", "AAPL", "NVDA", "MSFT", "AMZN", "GOOGL", "META", "BA", "TM", "005930.KS",
    ]
}


class RSSIngester:
    def fetch_company_feed(self, ticker: str) -> list[dict]:
        feed_urls = DEFAULT_FEEDS.get(ticker, [
            f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"
        ])
        results: list[dict] = []
        for url in feed_urls:
            try:
                parsed = feedparser.parse(url)
            except Exception as exc:
                logger.warning("RSS feed parse failed", ticker=ticker, url=url, error=str(exc))
                continue

            for entry in parsed.entries:
                published: Optional[str] = None
                if hasattr(entry, "published_parsed") and entry.published_parsed:
                    try:
                        published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()
                    except Exception:
                        pass

                results.append(
                    {
                        "title": getattr(entry, "title", ""),
                        "url": getattr(entry, "link", ""),
                        "published": published,
                        "summary": getattr(entry, "summary", ""),
                        "source_name": parsed.feed.get("title", f"Yahoo Finance RSS ({ticker})"),
                    }
                )
        return results
