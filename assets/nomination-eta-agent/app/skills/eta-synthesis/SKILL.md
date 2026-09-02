---
name: eta-synthesis
description: Combines outputs from the three specialist agents (Historical, AIS, Geopolitical/Weather) into a single weighted ETA proposal with confidence score and natural-language reasoning.
---

# ETA Synthesis Skill

## Purpose

Synthesise the outputs from the three specialist agents into a final weighted ETA proposal with confidence, reasoning, and supporting evidence.

## Weighting Logic

| Condition | Historical Weight | AIS Weight | Geo/Weather Adjustment |
|-----------|------------------|------------|----------------------|
| AIS available, vessel underway | 25% | 60% | +/- delay days |
| AIS not available (vessel not found) | 70% | 0% | +/- delay days (30%) |
| Vessel moored/anchored | 50% | 20% | +/- delay days (30%) |

## Instructions

### Step 1: Read Agent Inputs

Receive outputs from:
- `historical_result` — from historical-nomination-agent
- `ais_result` — from ais-vessel-tracking-agent
- `geo_weather_result` — from geo-weather-agent

### Step 2: Determine Weighting Scenario

Check `ais_result.vessel_status`:
- `"underway"` → Scenario A (AIS 60%, Historical 25%)
- `"moored_or_anchored"` → Scenario B (Historical 50%, AIS distance 20%)
- `"vessel_not_found"` → Scenario C (Historical 70%)

### Step 3: Compute Base ETA

From historical: `base_eta = now + avg_lead_time_days`
From AIS: `ais_eta = predicted_eta_utc`

Weighted ETA date (Scenario A): `0.25 * historical_eta + 0.60 * ais_eta` (as day offsets from now)
Apply geo/weather delay: `final_eta = weighted_eta + total_estimated_delay_days`

### Step 4: Assign Confidence

Take the MINIMUM confidence of all three agents.
If AIS is missing: cap at "Medium" regardless of other agents.

### Step 5: Generate Reasoning

Compose a plain-language explanation:
- Include vessel position and speed (if available)
- Include historical average and sample size
- Include geo/weather risk summary
- State confidence and rationale

Example:
> "Vessel MT EXCELLENCE is currently 1,200 NM from Rotterdam, travelling at 14.2 knots. Historical voyages for this route averaged 4.1 days (12 records, High confidence). Current weather assessment shows Low risk; no significant geopolitical events detected. Predicted ETA: 10 September 2026 at 14:00 UTC. Confidence: High."

### Step 6: Return Structured Proposal

Return the full proposal object as specified in the orchestrator response schema.
