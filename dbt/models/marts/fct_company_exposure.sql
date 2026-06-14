-- Fact table: aggregated risk exposure by company and date.
-- Used to power the 60-day trend chart and company exposure bar.

WITH events AS (
    SELECT * FROM {{ ref('stg_risk_events') }}
    WHERE status = 'published'
),

daily_agg AS (
    SELECT
        company_id,
        event_date,
        avg(risk_score)                     AS avg_risk_score,
        max(risk_score)                     AS max_risk_score,
        count()                             AS event_count,
        countIf(severity = 'critical')      AS critical_count,
        countIf(severity = 'high')          AS high_count,
        countIf(severity = 'medium')        AS medium_count,
        countIf(severity = 'low')           AS low_count
    FROM events
    GROUP BY company_id, event_date
)

SELECT
    company_id,
    event_date,
    toFloat32(avg_risk_score)               AS avg_risk_score,
    toInt32(max_risk_score)                 AS max_risk_score,
    toInt32(event_count)                    AS event_count,
    toInt32(critical_count)                 AS critical_count,
    toInt32(high_count)                     AS high_count,
    toInt32(medium_count)                   AS medium_count,
    toInt32(low_count)                      AS low_count
FROM daily_agg
ORDER BY company_id, event_date
