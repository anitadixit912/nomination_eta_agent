---
name: historical-analysis
description: Analyses historical nomination records from OGS/650 to extract voyage patterns, average lead times, delay frequencies, and seasonal trends for a given material, route, and transport system.
---

# Historical Analysis Skill

## Purpose

Analyse historical nomination records to produce a statistically grounded ETA estimate baseline for a given material, transport system, origin, and destination.

## Instructions

### Step 1: Query Historical Nominations

Use the `query_historical_nominations` tool to retrieve past nominations filtered by:
- `material` — the material code from the current nomination
- `transport_system` — the transport system ID
- `origin` — origin location ID
- `destination` — destination location ID

Set `$top=100` on the query. If fewer than 5 records are returned, widen the filter to transport system + material only (drop location filter) and note this in reasoning.

### Step 2: Extract Lead Times

For each historical nomination record:
- Calculate lead time in days: `actual_arrival_date - nomination_date`
- If actual arrival date is missing, use planned ETA as proxy and flag in reasoning
- Filter out obvious outliers (lead time < 0 or > 90 days)

### Step 3: Compute Statistics

Calculate:
- `avg_lead_time_days`: mean of all valid lead times
- `min_days`: minimum lead time
- `max_days`: maximum lead time
- `std_dev`: standard deviation
- `sample_size`: count of records used

### Step 4: Identify Recent Trend

Compare the last 5 voyages against the historical average:
- If last 5 average > historical average + 0.5 days → `recent_trend: "increasing"`
- If last 5 average < historical average - 0.5 days → `recent_trend: "decreasing"`
- Otherwise → `recent_trend: "stable"`

### Step 5: Seasonal Patterns

If sample_size ≥ 10:
- Group records by month
- Identify months where average lead time deviates > 1 day from overall average
- Note these in `seasonal_note`

### Step 6: Assign Confidence

| Sample Size | Confidence |
|-------------|------------|
| ≥ 10        | High       |
| 5–9         | Medium     |
| < 5         | Low        |

### Step 7: Return Result

Return a structured JSON object:
```json
{
  "agent": "historical-nomination-agent",
  "avg_lead_time_days": 4.1,
  "min_days": 3,
  "max_days": 6,
  "std_dev": 0.8,
  "sample_size": 12,
  "recent_trend": "stable",
  "seasonal_note": "November–January voyages average 1.2 days longer",
  "confidence": "High",
  "reasoning": "Based on 12 historical voyages for CRUDE_A via TS001 (Ras Tanura → Rotterdam), average lead time is 4.1 days (range: 3–6 days, std dev: 0.8). Recent 5 voyages are consistent with historical average. No unusual seasonal patterns detected."
}
```
