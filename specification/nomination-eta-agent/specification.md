# Specification: nomination-eta-agent

> **Guidelines**: Read all applicable guidelines before executing ANY tasks below:
> - [guidelines.md](../guidelines.md) — Universal execution rules
> - [guidelines-agent.md](../guidelines-agent.md) — Universal agent patterns
> - [guidelines-agent-python.md](../guidelines-agent-python.md) — Python implementation details
> - [guidelines-agent-skills.md](../guidelines-agent-skills.md) — Runtime skills patterns
> - [guidelines-agent-mcp.md](../guidelines-agent-mcp.md) — MCP integration patterns

---

## Basic Setup

- [ ] Read `product-requirements-document.md` and `intent.md` for full context
- [ ] Bootstrap agent code in `assets/nomination-eta-agent/` using the `sap-agent-bootstrap` instructions
- [ ] Install dependencies, validate agent starts and responds at `/.well-known/agent.json`

---

## Runtime Skills

- [ ] Create `assets/nomination-eta-agent/app/skills/eta-synthesis/SKILL.md` with:
  - **name**: `eta-synthesis`
  - **description**: `Combines outputs from the three specialist agents (Historical, AIS, Geopolitical/Weather) into a single weighted ETA proposal with confidence score and natural-language reasoning`
  - **Body**:
    - Input: results from historical-nomination-agent, ais-vessel-tracking-agent, geo-weather-agent
    - Weighting logic:
      - If AIS data available (vessel underway): AIS ETA = 60%, Historical avg = 25%, Geo/Weather delay adjustment = 15%
      - If AIS not available (vessel not found): Historical avg = 70%, Geo/Weather delay adjustment = 30%
      - If vessel moored/anchored: Historical avg = 50%, Geo/Weather = 30%, AIS position distance = 20%
    - Apply geo/weather delay: `final_eta = weighted_eta_date + total_estimated_delay_days`
    - Confidence: inherit the lowest confidence of the three agents; if AIS missing, cap at "Medium"
    - Produce reasoning string: "Vessel is currently X NM from [destination] at Y knots. Historical voyages for this route averaged Z days. [Risk factor] adds an estimated N days. Predicted ETA: [date]. Confidence: [level]."
    - On rejection: re-run with wider historical sample (all routes, not just exact match), produce 3 alternatives varying by: (1) optimistic – last 3 voyages, (2) baseline – full historical avg, (3) conservative – avg + 1 std dev + geo delay

- [ ] Create `assets/nomination-eta-agent/app/skills/rejection-handling/SKILL.md` with:
  - **name**: `rejection-handling`
  - **description**: `Handles supervisor rejection of an ETA proposal by performing deeper historical analysis and generating 2–3 alternative ETA proposals with independent reasoning`
  - **Body**: Step-by-step instructions for generating the three alternatives (optimistic, baseline, conservative) with confidence and supporting evidence for each

- [ ] Create `assets/nomination-eta-agent/app/skills/audit-logging/SKILL.md` with:
  - **name**: `audit-logging`
  - **description**: `Writes a structured audit log entry to the CAP audit service for every ETA decision (approval, rejection, manual override, write-back)`
  - **Body**: audit event schema and instructions for calling the CAP audit endpoint

---

## Project-Specific Tasks

### Specialist Agent Orchestration (A2A)

- [ ] Implement tool: `call_historical_agent` — sends A2A request to `historical-nomination-agent` at `{{HISTORICAL_AGENT_URL}}/invoke` with nomination context (material, transport_system, origin, destination); returns structured JSON from that agent
- [ ] Implement tool: `call_ais_agent` — sends A2A request to `ais-vessel-tracking-agent` at `{{AIS_AGENT_URL}}/invoke` with vessel MMSI/IMO and destination; returns structured JSON
- [ ] Implement tool: `call_geo_weather_agent` — sends A2A request to `geo-weather-agent` at `{{GEO_WEATHER_AGENT_URL}}/invoke` with origin and destination; returns structured JSON
- [ ] All three calls should be made concurrently (use `asyncio.gather`) — total latency = slowest agent, not sum of all
- [ ] If any specialist agent fails: log the failure, continue with available data, note missing source in reasoning

### ETA Write-Back to OGS/650

- [ ] Implement tool: `write_eta_to_nomination` — calls the CAP backend service `POST /api/nominations/{id}/eta` with approved ETA, decision maker, and reasoning; the CAP service handles the actual OGS/650 write-back (SOAP call)
- [ ] This tool is ONLY called after supervisor approval — never autonomously

### Agent System Prompt

- [ ] Write agent system prompt covering:
  - Role: "You are the Nomination ETA Orchestrator. You coordinate three specialist agents to produce an ETA proposal for a cargo nomination, present it to the supervisor for approval, and handle the approval/rejection workflow."
  - Instruction: always run all three specialist agents before producing a proposal
  - Instruction: load `eta-synthesis` skill before synthesising the final proposal
  - Instruction: on rejection, load `rejection-handling` skill and produce exactly 3 alternative ETAs
  - Instruction: after approval, use `write_eta_to_nomination` tool and then load `audit-logging` skill
  - Guardrail: NEVER call `write_eta_to_nomination` without an explicit approval signal in the conversation context
  - Guardrail: NEVER fabricate ETA data — all numbers must come from specialist agent responses

### Environment Variables in `asset.yaml`

- [ ] `HISTORICAL_AGENT_URL` — base URL of historical-nomination-agent (placeholder: `http://localhost:8001`)
- [ ] `AIS_AGENT_URL` — base URL of ais-vessel-tracking-agent (placeholder: `http://localhost:8002`)
- [ ] `GEO_WEATHER_AGENT_URL` — base URL of geo-weather-agent (placeholder: `http://localhost:8003`)
- [ ] `CAP_SERVICE_URL` — base URL of nomination-eta-cap service (placeholder: `http://localhost:4004`)

### Orchestrator Response Schema (to Approval Queue UI)

- [ ] Ensure the agent returns a structured proposal object:
  ```json
  {
    "nomination_id": "<id>",
    "proposed_eta_utc": "2026-09-10T14:00:00Z",
    "confidence": "High|Medium|Low",
    "reasoning": "<combined plain-language explanation>",
    "supporting_evidence": {
      "historical": { "avg_lead_time_days": 4.1, "sample_size": 12 },
      "ais": { "remaining_distance_nm": 1200, "sog_knots": 14.2 },
      "geo_weather": { "overall_risk": "Low", "delay_days": 0 }
    },
    "status": "proposal|awaiting_approval|approved|rejected",
    "alternatives": []
  }
  ```
- [ ] On rejection, populate `alternatives` array with 3 objects, each with `eta_utc`, `confidence`, `label` ("Optimistic|Baseline|Conservative"), and `reasoning`

---

## Business Instrumentation

- [ ] Implement ALL 7 PRD milestones with structured log statements:
  - `M1.achieved/missed` — nomination detected, orchestrator triggered
  - `M2.achieved/missed` — all specialist agents returned results
  - `M3.achieved/missed` — ETA proposal generated and presented to supervisor
  - `M4.achieved/missed` — supervisor decision received (approved/rejected)
  - `M5.achieved/missed` — ETA written to OGS/650, audit log created
  - `M6.achieved/missed` — reassessment complete, alternatives presented
  - `M7.achieved/missed` — vessel deviation detected, re-review triggered
- [ ] Extract business logic from `stream()` into `_run_orchestration()` async helper; use `@tracer.start_as_current_span("eta-orchestration")`
- [ ] Verify `auto_instrument()` is called at top of `main.py`

---

## MCP Tool Integration

- [ ] No SAP MCP servers directly required by orchestrator — SAP API access is delegated to specialist agents
- [ ] Orchestrator communicates with specialist agents via A2A HTTP calls (not MCP)
- [ ] Wire MCP tool loading via `get_mcp_tools()` for any tools registered through the MCP gateway
- [ ] Generate `mcp-mock.json` using `mcp-mock-config` skill — mock all three specialist agent A2A responses

---

## Testing

- [ ] `conftest.py` only sets `IBD_TESTING=true`
- [ ] Write unit test: `test_call_historical_agent` — mocks A2A response; asserts result parsed correctly
- [ ] Write unit test: `test_call_ais_agent` — mocks A2A response; asserts ETA extracted correctly
- [ ] Write unit test: `test_call_geo_weather_agent` — mocks A2A response; asserts risk and delay extracted
- [ ] Write unit test: `test_eta_synthesis_all_sources` — all three agents available; asserts weighted ETA calculation correct, confidence = "High"
- [ ] Write unit test: `test_eta_synthesis_no_ais` — AIS agent returns vessel_not_found; asserts confidence capped at "Medium", historical weight = 70%
- [ ] Write unit test: `test_rejection_generates_three_alternatives` — supervisor rejects; asserts exactly 3 alternatives returned with labels Optimistic/Baseline/Conservative
- [ ] Write unit test: `test_write_eta_blocked_without_approval` — assert `write_eta_to_nomination` is never called unless approval signal present
- [ ] Write integration test: full orchestration — nomination for CRUDE_A vessel MMSI 123456789 Hormuz→Rotterdam; mock all three specialist agents; assert structured proposal returned with confidence and reasoning
- [ ] Run `pytest` from `assets/nomination-eta-agent/` (no args)
- [ ] Verify coverage ≥ 70%
- [ ] Verify exactly 5 decorated functions in `agent.py`
- [ ] Run `pytest` again (no args) to generate final `test_report.json`
- [ ] Verify `test_report.json` exists in `assets/nomination-eta-agent/`
