"""Contract guard: asserts that Python schema field names match TypeScript types.

If someone renames a field in schemas.py without updating frontend/lib/api.ts
(or vice versa), this test will fail.
"""

import re
from pathlib import Path

from app.schemas import CompanyExposure, DashboardRead, RiskEventRead, TopicHeatmapCell, TrendPoint

_TS_PATH = Path(__file__).parents[2] / "frontend" / "lib" / "api.ts"


def _parse_ts_type_fields(ts_source: str, type_name: str) -> set[str]:
    """Extract top-level field names from a TypeScript type block.

    Handles nested inline types (e.g. `ai_summary: { title: string; ... }`)
    by only capturing fields at the first level of brace depth.
    """
    # Locate the opening brace of the type declaration.
    header_pattern = rf"export\s+type\s+{re.escape(type_name)}\s*=\s*\{{"
    header_match = re.search(header_pattern, ts_source, re.DOTALL)
    if not header_match:
        return set()

    start = header_match.end()
    depth = 1
    pos = start
    while pos < len(ts_source) and depth > 0:
        if ts_source[pos] == "{":
            depth += 1
        elif ts_source[pos] == "}":
            depth -= 1
        pos += 1
    block = ts_source[start : pos - 1]

    # Only capture fields at depth 0 within this block (skip nested braces).
    # A field is at depth 0 when inner_depth is 0 both before and after the line.
    fields: set[str] = set()
    inner_depth = 0
    for line in block.splitlines():
        stripped = line.strip()
        opens = stripped.count("{")
        closes = stripped.count("}")
        depth_before = inner_depth
        inner_depth += opens - closes
        # A top-level field has no braces that increase nesting; capture only
        # when the line starts at depth 0 and does not itself open a new scope.
        if depth_before == 0 and opens == 0:
            m = re.match(r"^([a-zA-Z_][a-zA-Z0-9_]*)\s*:", stripped)
            if m:
                fields.add(m.group(1))
        elif depth_before == 0 and opens > 0 and closes == 0:
            # Line opens a nested block (e.g. `ai_summary: {`); still top-level field.
            m = re.match(r"^([a-zA-Z_][a-zA-Z0-9_]*)\s*:", stripped)
            if m:
                fields.add(m.group(1))
    return fields


def _python_fields(model_class) -> set[str]:
    return set(model_class.model_fields.keys())


def test_contract_ts_file_exists():
    assert _TS_PATH.exists(), f"Frontend api.ts not found at {_TS_PATH}"


def test_risk_event_contract():
    ts = _TS_PATH.read_text()
    ts_fields = _parse_ts_type_fields(ts, "RiskEvent")
    py_fields = _python_fields(RiskEventRead)

    # Fields that are in Python but intentionally absent from the TS type (internal).
    py_only = {"status", "fetched_at", "content_hash"}
    py_public = py_fields - py_only

    missing_in_ts = py_public - ts_fields
    assert not missing_in_ts, (
        f"Fields in RiskEventRead (Python) missing from RiskEvent (TypeScript): {missing_in_ts}"
    )

    missing_in_py = ts_fields - py_fields
    assert not missing_in_py, (
        f"Fields in RiskEvent (TypeScript) missing from RiskEventRead (Python): {missing_in_py}"
    )


def test_dashboard_data_contract():
    ts = _TS_PATH.read_text()
    ts_fields = _parse_ts_type_fields(ts, "DashboardData")
    py_fields = _python_fields(DashboardRead)

    # TypeScript uses DashboardData; Python uses DashboardRead — both should share the same keys.
    missing_in_ts = py_fields - ts_fields
    assert not missing_in_ts, (
        f"Fields in DashboardRead (Python) missing from DashboardData (TypeScript): {missing_in_ts}"
    )

    missing_in_py = ts_fields - py_fields
    assert not missing_in_py, (
        f"Fields in DashboardData (TypeScript) missing from DashboardRead (Python): {missing_in_py}"
    )


def test_company_exposure_contract():
    ts = _TS_PATH.read_text()
    ts_fields = _parse_ts_type_fields(ts, "CompanyExposure")
    py_fields = _python_fields(CompanyExposure)
    assert ts_fields == py_fields, (
        f"CompanyExposure mismatch — TS: {ts_fields}, Python: {py_fields}"
    )


def test_topic_heatmap_cell_contract():
    ts = _TS_PATH.read_text()
    ts_fields = _parse_ts_type_fields(ts, "TopicHeatmapCell")
    py_fields = _python_fields(TopicHeatmapCell)
    assert ts_fields == py_fields, (
        f"TopicHeatmapCell mismatch — TS: {ts_fields}, Python: {py_fields}"
    )


def test_trend_point_contract():
    ts = _TS_PATH.read_text()
    ts_fields = _parse_ts_type_fields(ts, "TrendPoint")
    py_fields = _python_fields(TrendPoint)
    assert ts_fields == py_fields, (
        f"TrendPoint mismatch — TS: {ts_fields}, Python: {py_fields}"
    )
