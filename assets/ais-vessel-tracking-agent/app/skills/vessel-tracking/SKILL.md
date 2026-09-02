---
name: vessel-tracking
description: Fetches live AIS data from AISStream.io for a given vessel IMO or MMSI number and computes remaining sailing time to destination port.
---

# Vessel Tracking Skill

## Purpose

Fetch live vessel position, speed, and heading from AISStream.io and compute the predicted ETA to the destination port using Haversine distance calculation.

## Instructions

### Step 1: Connect to AISStream.io

Use the `fetch_vessel_position` tool with the vessel MMSI or IMO number.

- WebSocket endpoint: `wss://stream.aisstream.io/v0/stream`
- Subscribe with: `{ "APIKey": "<key>", "BoundingBoxes": [[[-90,-180],[90,180]]], "FiltersShipMMSI": ["<mmsi>"] }`
- Read first position message, then close connection (10-second timeout)

### Step 2: Extract Vessel Data

From the AIS message extract:
- `latitude`, `longitude` — current position
- `sog` — speed over ground in knots
- `cog` — course over ground in degrees
- `destination` — vessel's declared destination (may differ from nomination)
- `navigational_status` — 0=underway, 1=anchored, 5=moored

### Step 3: Handle Edge Cases

| Condition | Action |
|-----------|--------|
| SOG < 1 knot | Set status = "moored_or_anchored", estimate distance only |
| Vessel not found (timeout) | Return status = "vessel_not_found", confidence = "Low" |
| AIS destination ≠ nomination destination | Set destination_mismatch = true, note in reasoning |

### Step 4: Calculate Remaining Journey

Use the `calculate_remaining_journey` tool:
1. Look up destination port coordinates from `major-port-coordinates.json`
2. Compute Haversine distance: `d = 2R * arcsin(sqrt(sin²(Δlat/2) + cos(lat1)*cos(lat2)*sin²(Δlon/2)))`
3. Convert to nautical miles
4. Estimated hours = `distance_nm / sog_knots`
5. Predicted ETA = `current_utc + timedelta(hours=estimated_hours)`

### Step 5: Assign Confidence

| Condition | Confidence |
|-----------|------------|
| Vessel underway, SOG > 5 knots, destination matches | High |
| Vessel underway, SOG 1–5 knots or destination mismatch | Medium |
| Vessel moored/anchored | Low |
| Vessel not found | Low |

### Step 6: Return Result

```json
{
  "agent": "ais-vessel-tracking-agent",
  "vessel_mmsi": "123456789",
  "vessel_name": "MT EXCELLENCE",
  "current_position": { "lat": 25.0, "lon": 56.0 },
  "sog_knots": 14.2,
  "cog_degrees": 315,
  "destination_from_ais": "ROTTERDAM",
  "nomination_destination": "ROTTERDAM",
  "destination_mismatch": false,
  "remaining_distance_nm": 1200,
  "estimated_sailing_hours": 84.5,
  "predicted_eta_utc": "2026-09-10T14:00:00Z",
  "vessel_status": "underway",
  "data_timestamp_utc": "2026-09-02T08:00:00Z",
  "confidence": "High",
  "reasoning": "Vessel MT EXCELLENCE is currently 1,200 NM from Rotterdam, travelling at 14.2 knots. Estimated sailing time: 84.5 hours (3.5 days). Predicted arrival: 2026-09-10T14:00:00Z."
}
```
