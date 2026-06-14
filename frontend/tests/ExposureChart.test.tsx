import { cloneElement, type ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// recharts uses ResizeObserver which is not available in jsdom
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ResponsiveContainer measures its parent via getBoundingClientRect, which
// returns 0×0 in jsdom — so the chart (and its axis labels) never render.
// Replace it with a fixed-size wrapper so the real chart lays out.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: ReactElement<{ width?: number; height?: number }>;
    }) => (
      <div style={{ width: 800, height: 400 }}>
        {cloneElement(children, { width: 800, height: 400 })}
      </div>
    ),
  };
});

import { ExposureChart } from "@/components/dashboard/ExposureChart";
import type { CompanyExposure } from "@/lib/api";

const mockData: CompanyExposure[] = [
  { company: "Acme Corp", ticker: "ACME", exposure: 82, event_count: 5 },
  { company: "Beta Inc", ticker: "BETA", exposure: 64, event_count: 3 },
  { company: "Gamma Ltd", ticker: "GMMA", exposure: 45, event_count: 2 },
];

describe("ExposureChart", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <ExposureChart
        data={mockData}
        selectedCompany={null}
        onSelect={() => {}}
      />,
    );
    expect(container).toBeTruthy();
  });

  it("renders ticker labels in the chart", () => {
    render(
      <ExposureChart
        data={mockData}
        selectedCompany={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("ACME")).toBeInTheDocument();
    expect(screen.getByText("BETA")).toBeInTheDocument();
    expect(screen.getByText("GMMA")).toBeInTheDocument();
  });

  it("accepts a selectedCompany prop without error", () => {
    const { container } = render(
      <ExposureChart
        data={mockData}
        selectedCompany="Acme Corp:ACME"
        onSelect={() => {}}
      />,
    );
    expect(container).toBeTruthy();
  });
});
