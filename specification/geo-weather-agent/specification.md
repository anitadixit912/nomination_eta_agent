# Specification: geo-weather-agent

> **Guidelines**: Read all applicable guidelines before executing ANY tasks below:
> - [guidelines.md](../guidelines.md) — Universal execution rules
> - [guidelines-agent.md](../guidelines-agent.md) — Universal agent patterns
> - [guidelines-agent-python.md](../guidelines-agent-python.md) — Python implementation details
> - [guidelines-agent-skills.md](../guidelines-agent-skills.md) — Runtime skills patterns
> - [guidelines-agent-mcp.md](../guidelines-agent-mcp.md) — MCP integration patterns

---

## Basic Setup

- [ ] Read `product-requirements-document.md` and `intent.md` for full context
- [ ] Bootstrap agent code in `assets/geo-weather-agent/` using the `sap-agent-bootstrap` instructions
- [ ] Install dependencies, validate agent starts and responds at `/.well-known/agent.json`

---

## Runtime Skills

- [ ] Create `assets/geo-weather-agent/app/skills/route-risk-assessment/SKILL.md` with:
  - **name**: `route-risk-assessment`
  - **description**: `Assesses geopolitical risk and weather conditions along a shipping route between origin and destination ports, returning a risk score and estimated delay impact`
  - **Body**: Step-by-step instructions:
    - Step 1 — Weather: call Open-Meteo marine API for waypoints along the route (origin, midpoint, destination); extract significant wave height, wind speed, wind direction; flag if wave height > 3m or wind > 25 knots
    - Step 2 — Geopolitical: call ACLED API for conflict events within 200 NM of route waypoints in the last 30 days; filter for maritime/port events
    - Step 3 — Port disruption: call PortWatch IMF API for traffic disruption index at origin and destination ports
    - Step 4 — Combine: produce a risk score (Low / Medium / High / Critical) with estimated delay days
    - Risk escalation table:
      - Wave height > 5m → High risk, +1–2 days delay
      - Active ACLED events on route → Medium–High risk, +0.5–3 days
      - PortWatch disruption index > 50% → Medium risk, +0.5–1 day
      - Multiple factors combined → Critical, +3–5 days
- [ ] Create companion reference `assets/geo-weather-agent/app/skills/route-risk-assessment/references/chokepoint-regions.json` — JSON mapping of major chokepoints to bounding boxes (Strait of Hormuz, Suez Canal, Red Sea, Bosphorus, Strait of Malacca, Gulf of Mexico)

---

## Project-Specific Tasks

### API Integrations (Free, no SAP MCP needed)

#### Open-Meteo (Weather — free, no key)
- [ ] Add `httpx` to `requirements.txt`
- [ ] Implement tool: `fetch_route_weather` — calls `https://marine-api.open-meteo.com/v1/marine` with lat/lon waypoints for origin, midpoint, destination; extracts `wave_height_max`, `wind_speed_10m_max`, `wind_direction_10m_dominant` for next 7 days; returns per-waypoint weather data and a worst-case summary
- [ ] No API key needed — call directly

#### ACLED (Geopolitical — free, registration required)
- [ ] Implement tool: `fetch_geopolitical_risk` — calls ACLED REST API `https://api.acleddata.com/acled/read` with parameters: `event_date_where=BETWEEN`, coordinates within 200 NM of route waypoints, `event_type=Battles|Explosions/Remote violence|Violence against civilians|Protests`; returns event count, latest event summary, and proximity to route
- [ ] Add environment variable to `asset.yaml`: `ACLED_API_KEY` and `ACLED_EMAIL` (both required for ACLED free tier)

#### PortWatch IMF (Port disruption — free, no key)
- [ ] Implement tool: `fetch_port_disruption` — calls PortWatch API `https://portwatch.imf.org/api/port-disruption` for origin and destination port codes; returns disruption index (0–100), trend (improving/worsening), and affected vessel count
- [ ] Handle gracefully if PortWatch API is unavailable (return `status: "unavailable"` — do not block ETA calculation)

### Agent System Prompt

- [ ] Write agent system prompt covering:
  - Role: "You are the Geopolitical & Weather Forecast Agent. Your purpose is to assess weather conditions and geopolitical risks along the shipping route between two ports and estimate the impact on vessel transit time."
  - Instruction: always load the `route-risk-assessment` skill via `load()` before analysis
  - Instruction: MUST use tools to retrieve live data — never fabricate risk scores
  - Instruction: if a data source is unavailable, note it explicitly in reasoning and proceed with available data
  - Guardrail: read-only — no writes to any external system

### Agent Response Schema

- [ ] Ensure the agent always returns:
  ```json
  {
    "agent": "geo-weather-agent",
    "origin": "<port>",
    "destination": "<port>",
    "route_waypoints": [{ "lat": 0.0, "lon": 0.0 }],
    "weather_summary": {
      "max_wave_height_m": 2.1,
      "max_wind_speed_kmh": 35,
      "weather_risk": "Low|Medium|High",
      "weather_delay_days": 0
    },
    "geopolitical_summary": {
      "acled_events_count": 3,
      "latest_event": "<description>",
      "chokepoints_affected": ["Red Sea"],
      "geo_risk": "Low|Medium|High|Critical",
      "geo_delay_days": 1.5
    },
    "port_disruption_summary": {
      "origin_disruption_index": 12,
      "destination_disruption_index": 8,
      "port_delay_days": 0
    },
    "overall_risk": "Low|Medium|High|Critical",
    "total_estimated_delay_days": 1.5,
    "confidence": "High|Medium|Low",
    "reasoning": "<plain language explanation of all risk factors>"
  }
  ```

---

## Business Instrumentation

- [ ] Implement structured logging:
  - `M2.achieved: geo-weather-agent assessment complete — route={origin}→{destination}, overall_risk={risk}, delay_days={days}`
  - `M2.missed: geo-weather-agent failed to complete assessment — reason={reason}`
- [ ] Extract business logic into `_run_assessment()` async helper; add `@tracer.start_as_current_span("geo-weather-assessment")`
- [ ] Verify `auto_instrument()` is called at top of `main.py`

---

## MCP Tool Integration

- [ ] No SAP MCP servers required — all three APIs (Open-Meteo, ACLED, PortWatch) are external REST APIs accessed via direct HTTP tools
- [ ] No `mcp-translation-file` invocation needed
- [ ] Generate `mcp-mock.json` using `mcp-mock-config` skill based on tool schemas (mock weather, ACLED, and PortWatch responses)

---

## Testing

- [ ] `conftest.py` only sets `IBD_TESTING=true`
- [ ] Write unit test: `test_fetch_route_weather` — mocks Open-Meteo response with wave_height=4.5m; asserts weather_risk = "High" and delay > 0
- [ ] Write unit test: `test_fetch_geopolitical_risk` — mocks ACLED response with 5 events in Red Sea area; asserts geo_risk = "High" and chokepoints_affected includes "Red Sea"
- [ ] Write unit test: `test_fetch_port_disruption` — mocks PortWatch response with disruption_index=65; asserts port_delay_days > 0
- [ ] Write unit test: `test_all_clear_route` — all sources return low risk; asserts overall_risk = "Low" and total_estimated_delay_days = 0
- [ ] Write unit test: `test_portwatch_unavailable` — PortWatch returns 503; asserts agent continues with available data and notes unavailability in reasoning
- [ ] Write integration test: route Hormuz→Rotterdam with mocked High geo risk + Medium weather; assert overall_risk = "High" and total_delay ≥ 2 days
- [ ] Run `pytest` from `assets/geo-weather-agent/` (no args)
- [ ] Verify coverage ≥ 70%
- [ ] Verify exactly 5 decorated functions in `agent.py`
- [ ] Run `pytest` again (no args) to generate final `test_report.json`
- [ ] Verify `test_report.json` exists in `assets/geo-weather-agent/`
