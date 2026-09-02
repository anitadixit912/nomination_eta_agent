# Specification: ais-vessel-tracking-agent

> **Guidelines**: Read all applicable guidelines before executing ANY tasks below:
> - [guidelines.md](../guidelines.md) — Universal execution rules
> - [guidelines-agent.md](../guidelines-agent.md) — Universal agent patterns
> - [guidelines-agent-python.md](../guidelines-agent-python.md) — Python implementation details
> - [guidelines-agent-skills.md](../guidelines-agent-skills.md) — Runtime skills patterns
> - [guidelines-agent-mcp.md](../guidelines-agent-mcp.md) — MCP integration patterns

---

## Basic Setup

- [ ] Read `product-requirements-document.md` and `intent.md` for full context
- [ ] Bootstrap agent code in `assets/ais-vessel-tracking-agent/` using the `sap-agent-bootstrap` instructions
- [ ] Install dependencies, validate agent starts and responds at `/.well-known/agent.json`

---

## Runtime Skills

- [ ] Create `assets/ais-vessel-tracking-agent/app/skills/vessel-tracking/SKILL.md` with:
  - **name**: `vessel-tracking`
  - **description**: `Fetches live AIS data from AISStream.io for a given vessel IMO or MMSI number and computes remaining sailing time to destination`
  - **Body**: Step-by-step instructions:
    - Connect to AISStream.io WebSocket API using AISSTREAM_API_KEY
    - Subscribe to position updates filtered by MMSI or IMO number
    - Extract: latitude, longitude, speed over ground (SOG), course over ground (COG), destination, navigational status
    - If destination matches nomination destination → compute remaining distance using Haversine formula (current position → destination port coordinates)
    - Compute estimated sailing time: `remaining_distance_nm / SOG_knots = hours`
    - Convert to days and add to current datetime → predicted ETA
    - Return structured result with all inputs and derived ETA
    - If vessel not found or SOG = 0 (anchored/moored) → return status with explanation
- [ ] Create companion file `assets/ais-vessel-tracking-agent/app/skills/vessel-tracking/references/major-port-coordinates.json` — a JSON lookup of lat/lon for major oil terminal ports (Rotterdam, Fujairah, Ras Tanura, Houston, Singapore, Corpus Christi, Milford Haven, Primorsk, Novorossiysk, Trieste)

---

## Project-Specific Tasks

### AISStream.io Integration

- [ ] Add `websockets` and `aiohttp` to `requirements.txt`
- [ ] Implement tool: `fetch_vessel_position` — connects to `wss://stream.aisstream.io/v0/stream`, subscribes with `{ "APIKey": "<key>", "BoundingBoxes": [[[-90,-180],[90,180]]], "FiltersShipMMSI": ["<mmsi>"] }`, reads first position message, closes connection, returns vessel data
- [ ] Implement tool: `calculate_remaining_journey` — takes current lat/lon, destination port name, looks up port coordinates from `major-port-coordinates.json`, computes Haversine distance in nautical miles, divides by SOG to get hours, returns `{ distance_nm, sog_knots, estimated_hours, predicted_eta_utc }`
- [ ] Handle edge cases:
  - Vessel SOG < 1 knot → return `status: "moored_or_anchored"`, use last known position for distance estimate only
  - Vessel not found in AIS stream after 10-second timeout → return `status: "vessel_not_found"`
  - Destination in AIS data does not match nomination destination → flag mismatch and note in reasoning
- [ ] Add environment variable to `asset.yaml`: `AISSTREAM_API_KEY` (placeholder: `your-aisstream-api-key`)

### Agent System Prompt

- [ ] Write agent system prompt covering:
  - Role: "You are the AIS Vessel Tracking Agent. Your sole purpose is to fetch live vessel position data from AISStream.io and compute the predicted ETA for a vessel to reach its destination port."
  - Instruction: MUST use tools to retrieve live data — never invent position data
  - Instruction: load the `vessel-tracking` SKILL.md via `load()` before processing
  - Instruction: always include data freshness timestamp (UTC) in response
  - Guardrail: read-only — no writes to any external system

### Agent Response Schema

- [ ] Ensure the agent always returns:
  ```json
  {
    "agent": "ais-vessel-tracking-agent",
    "vessel_mmsi": "<mmsi>",
    "vessel_name": "<name>",
    "current_position": { "lat": 0.0, "lon": 0.0 },
    "sog_knots": 14.2,
    "cog_degrees": 315,
    "destination_from_ais": "<port>",
    "nomination_destination": "<port>",
    "destination_mismatch": false,
    "remaining_distance_nm": 1200,
    "estimated_sailing_hours": 84.5,
    "predicted_eta_utc": "2026-09-10T14:00:00Z",
    "vessel_status": "underway|moored_or_anchored|vessel_not_found",
    "data_timestamp_utc": "2026-09-02T08:00:00Z",
    "confidence": "High|Medium|Low",
    "reasoning": "<plain language explanation>"
  }
  ```

---

## Business Instrumentation

- [ ] Implement structured logging:
  - `M2.achieved: ais-vessel-tracking-agent returned vessel data — mmsi={mmsi}, sog={sog}, predicted_eta={eta}`
  - `M2.missed: ais-vessel-tracking-agent failed to retrieve vessel data — reason={reason}`
- [ ] Extract business logic from `stream()` into `_run_tracking()` async helper; add `@tracer.start_as_current_span("ais-vessel-tracking")`
- [ ] Verify `auto_instrument()` is called at top of `main.py`

---

## MCP Tool Integration

- [ ] No SAP MCP servers required for this agent — AISStream.io is accessed via direct WebSocket tool (not SAP API)
- [ ] No `mcp-translation-file` invocation needed
- [ ] Generate `mcp-mock.json` using `mcp-mock-config` skill based on the agent's tool schemas (mock vessel position response for testing)

---

## Testing

- [ ] `conftest.py` only sets `IBD_TESTING=true`
- [ ] Write unit test: `test_fetch_vessel_position` — mocks WebSocket connection returning position message for MMSI 123456789; asserts lat, lon, SOG extracted correctly
- [ ] Write unit test: `test_calculate_remaining_journey` — vessel at (25.0, 56.0), destination "Rotterdam"; asserts distance and ETA are calculated correctly
- [ ] Write unit test: `test_vessel_not_found` — mocks WebSocket timeout; asserts status = "vessel_not_found" and confidence = "Low"
- [ ] Write unit test: `test_moored_vessel` — mocks SOG = 0.2; asserts status = "moored_or_anchored"
- [ ] Write unit test: `test_destination_mismatch` — AIS destination = "FUJAIRAH" but nomination destination = "ROTTERDAM"; asserts `destination_mismatch: true`
- [ ] Write integration test: full agent flow — given MMSI for a vessel 1200 NM from Rotterdam at 14 knots; assert predicted ETA ≈ 3.6 days from now
- [ ] Run `pytest` from `assets/ais-vessel-tracking-agent/` (no args)
- [ ] Verify coverage ≥ 70%
- [ ] Verify exactly 5 decorated functions in `agent.py`
- [ ] Run `pytest` again (no args) to generate final `test_report.json`
- [ ] Verify `test_report.json` exists in `assets/ais-vessel-tracking-agent/`
