-- Staging model: clean and standardize raw risk_events from ClickHouse.
-- Source: risk_events table synced from Postgres via ClickHouseClient.sync_events().

WITH source AS (
    SELECT
        id,
        company_id,
        topic_id,
        toDate(event_date)                  AS event_date,
        lower(trim(severity))               AS severity,
        toInt32(risk_score)                 AS risk_score,
        toInt32(exposure_score)             AS exposure_score,
        toFloat32(confidence)               AS confidence,
        lower(trim(source_type))            AS source_type,
        lower(trim(status))                 AS status,
        toDateTime(extracted_at)            AS extracted_at
    FROM {{ source('signallens_raw', 'risk_events') }}
    WHERE id IS NOT NULL
      AND risk_score BETWEEN 0 AND 100
      AND confidence BETWEEN 0 AND 1
)

SELECT * FROM source
