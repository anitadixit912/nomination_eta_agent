---
name: rejection-handling
description: Handles supervisor rejection of an ETA proposal by performing deeper historical analysis and generating 2-3 alternative ETA proposals with independent reasoning.
---

# Rejection Handling Skill

## Purpose

When the supervisor rejects the initial ETA proposal, generate exactly 3 alternative ETAs based on different analytical perspectives.

## Instructions

### Step 1: Acknowledge Rejection

Log the rejection (M6 milestone). If a rejection reason was provided, store it for reasoning.

### Step 2: Generate Three Alternatives

#### Alternative 1 — Optimistic

- Source: Last 3 historical voyages only (most recent performance)
- Calculation: average of last 3 lead times, no delay adjustment
- Label: "Optimistic"
- Confidence: "Medium" (small sample)
- Reasoning: "Based on the 3 most recent voyages on this route, which averaged X days. Recent performance suggests faster-than-average transit."

#### Alternative 2 — Baseline

- Source: Full historical average (same as initial proposal)
- Calculation: avg_lead_time_days + geo/weather delay
- Label: "Baseline"
- Confidence: inherit from historical agent
- Reasoning: "Based on all X historical voyages (average Y days). This represents the most statistically balanced estimate."

#### Alternative 3 — Conservative

- Source: Historical average + 1 standard deviation + full geo/weather delay
- Calculation: (avg_lead_time_days + std_dev) + total_estimated_delay_days
- Label: "Conservative"
- Confidence: "High" (accounts for variance)
- Reasoning: "Based on historical average plus one standard deviation to account for variability, plus current route risk factors. Recommended when operational planning requires buffer time."

### Step 3: Return Alternatives Array

Return exactly 3 alternative objects in the `alternatives` array of the proposal.

Each alternative must include:
- `label`: "Optimistic" | "Baseline" | "Conservative"
- `eta_utc`: ISO 8601 datetime
- `confidence`: "High" | "Medium" | "Low"
- `reasoning`: Plain-language explanation
