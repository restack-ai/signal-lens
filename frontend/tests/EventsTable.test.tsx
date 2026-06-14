import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EventsTable } from "@/components/dashboard/EventsTable";
import type { RiskEvent } from "@/lib/api";

function makeEvent(id: number): RiskEvent {
  return {
    id,
    title: `Event ${id}`,
    company_id: 1,
    company: "Acme Corp",
    ticker: "ACME",
    topic: "Regulation",
    topic_label: "Regulation",
    source_type: "SEC",
    source_name: "SEC Filing",
    source_url: "https://example.com",
    extracted_at: "2026-01-01T00:00:00Z",
    event_date: "2026-01-01",
    severity: "high",
    confidence: 0.85,
    risk_score: 75,
    exposure_score: 80,
    summary: `Summary for event ${id}`,
    evidence_excerpt: `Evidence for event ${id}`,
    risk_driver_summary: `Risk driver for event ${id}`,
    suggested_action: `Action for event ${id}`,
  };
}

const FIFTEEN_EVENTS = Array.from({ length: 15 }, (_, i) => makeEvent(i + 1));

describe("EventsTable", () => {
  it("renders only pageSize rows when given 15 events and pageSize=10", () => {
    render(
      <EventsTable
        events={FIFTEEN_EVENTS.slice(0, 10)}
        page={0}
        pageSize={10}
        total={15}
        onPageChange={() => {}}
      />,
    );
    // Events 1–10 should be visible
    expect(screen.getByText("Event 1")).toBeInTheDocument();
    expect(screen.getByText("Event 10")).toBeInTheDocument();
    // Event 11 should NOT be in the DOM (it's on page 2)
    expect(screen.queryByText("Event 11")).not.toBeInTheDocument();
  });

  it("shows pagination controls when total > pageSize", () => {
    render(
      <EventsTable
        events={FIFTEEN_EVENTS.slice(0, 10)}
        page={0}
        pageSize={10}
        total={15}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByText("Showing 1–10 of 15 events")).toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("does not show pagination controls when total <= pageSize", () => {
    render(
      <EventsTable
        events={FIFTEEN_EVENTS.slice(0, 5)}
        page={0}
        pageSize={10}
        total={5}
        onPageChange={() => {}}
      />,
    );
    expect(screen.queryByText("Previous")).not.toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });

  it("Previous button is disabled on page 0", () => {
    render(
      <EventsTable
        events={FIFTEEN_EVENTS.slice(0, 10)}
        page={0}
        pageSize={10}
        total={15}
        onPageChange={() => {}}
      />,
    );
    const prevBtn = screen.getByText("Previous");
    expect(prevBtn).toBeDisabled();
  });

  it("renders correct row count", () => {
    render(
      <EventsTable
        events={FIFTEEN_EVENTS.slice(0, 10)}
        page={0}
        pageSize={10}
        total={15}
        onPageChange={() => {}}
      />,
    );
    // 10 data rows + 1 header row = 11 rows total, so 10 tbody rows
    const rows = screen.getAllByRole("row");
    // header row + 10 data rows
    expect(rows).toHaveLength(11);
  });
});
