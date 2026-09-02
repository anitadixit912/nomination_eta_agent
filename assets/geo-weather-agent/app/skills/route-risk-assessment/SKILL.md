---
name: route-risk-assessment
description: Assesses geopolitical risk and weather conditions along a shipping route between origin and destination ports, returning a risk score and estimated delay impact.
---

# Route Risk Assessment Skill

## Purpose

Combine weather, geopolitical, and port disruption data to produce a route risk score and estimated delay days for a cargo nomination voyage.

## Instructions

### Step 1: Weather Assessment (Open-Meteo)

Call `fetch_route_weather` tool for origin, midpoint, and destination waypoints:
- API: `https://marine-api.open-meteo.com/v1/marine` (no key required)
- Parameters: `latitude`, `longitude`, `hourly=wave_height,wind_speed_10m,wind_direction_10m`, `forecast_days=7`

Extract worst-case values across all waypoints for the 7-day forecast window.

Risk mapping:
| Wave Height | Wind Speed | Weather Risk | Delay Days |
|-------------|------------|--------------|-----------|
| < 2m | < 20 knots | Low | 0 |
| 2–3m | 20–30 knots | Medium | 0.5 |
| 3–5m | 30–40 knots | High | 1–2 |
| > 5m | > 40 knots | Critical | 2–4 |

### Step 2: Geopolitical Assessment (ACLED)

Call `fetch_geopolitical_risk` tool:
- API: `https://api.acleddata.com/acled/read`
- Filter: last 30 days, within 200 NM of route waypoints
- Event types: Battles, Explosions/Remote violence, Protests affecting ports

Check chokepoint bounding boxes from `chokepoint-regions.json`.

Risk mapping:
| Events | Proximity | Geo Risk | Delay Days |
|--------|-----------|----------|-----------|
| 0 | Any | Low | 0 |
| 1–3 | > 100 NM | Low | 0 |
| 1–3 | < 100 NM | Medium | 0.5 |
| 4–10 | Any | High | 1–2 |
| > 10 | Any | Critical | 2–4 |

### Step 3: Port Disruption (PortWatch IMF)

Call `fetch_port_disruption` tool:
- API: `https://portwatch.imf.org/api/port-disruption`
- Fetch for origin and destination port codes

If API unavailable → set status = "unavailable", continue with other data.

Disruption index mapping:
| Index | Port Risk | Delay Days |
|-------|-----------|-----------|
| 0–20 | Low | 0 |
| 21–50 | Medium | 0.5 |
| 51–80 | High | 1 |
| > 80 | Critical | 2 |

### Step 4: Combine Risk

Overall risk = maximum of (weather_risk, geo_risk, port_risk).
Total estimated delay = sum of all delay_days (capped at 7 days).

### Step 5: Return Result

Return structured JSON with all sub-scores, overall risk, total delay, and plain-language reasoning.
