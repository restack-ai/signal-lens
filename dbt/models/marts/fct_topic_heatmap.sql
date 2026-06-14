-- Fact table: aggregated risk score by company × topic.
-- Powers the topic heatmap on the dashboard.

WITH events AS (
    SELECT * FROM {{ ref('stg_risk_events') }}
    WHERE status = 'published'
),

agg AS (
    SELECT
        company_id,
        topic_id,
        avg(risk_score)                     AS avg_score,
        max(risk_score)                     AS max_score,
        count()                             AS event_count,
        avg(confidence)                     AS avg_confidence
    FROM events
    GROUP BY company_id, topic_id
)

SELECT
    company_id,
    topic_id,
    toFloat32(avg_score)                    AS avg_score,
    toInt32(max_score)                      AS max_score,
    toInt32(event_count)                    AS event_count,
    toFloat32(avg_confidence)               AS avg_confidence
FROM agg
ORDER BY company_id, avg_score DESC
