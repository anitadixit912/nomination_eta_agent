# Specification: historical-nomination-agent

> **Guidelines**: Read all applicable guidelines before executing ANY tasks below:
> - [guidelines.md](../guidelines.md) — Universal execution rules
> - [guidelines-agent.md](../guidelines-agent.md) — Universal agent patterns
> - [guidelines-agent-python.md](../guidelines-agent-python.md) — Python implementation details
> - [guidelines-agent-skills.md](../guidelines-agent-skills.md) — Runtime skills patterns
> - [guidelines-agent-mcp.md](../guidelines-agent-mcp.md) — MCP integration patterns

---

## Basic Setup

- [ ] Read `product-requirements-document.md` and `intent.md` for full context
- [ ] Bootstrap agent code in `assets/historical-nomination-agent/` using the `sap-agent-bootstrap` instructions (invoke from inside `assets/historical-nomination-agent/`, use copy commands — do NOT create files manually)
- [ ] Install dependencies, validate the agent starts and responds at `/.well-known/agent.json`

---

## Runtime Skills

- [ ] Create `assets/historical-nomination-agent/app/skills/historical-analysis/SKILL.md` with:
  - **name**: `historical-analysis`
  - **description**: `Analyses historical nomination records from OGS/650 to extract voyage patterns, average lead times, delay frequencies, and seasonal trends for a given material, route, and transport system`
  - **Body**: Step-by-step instructions covering:
    - Query historical nominations filtered by material + transport system + origin + destination
    - Extract: nomination date, planned ETA, actual arrival, lead time in days, delay (if any)
    - Compute: average lead time, min/max range, standard deviation, count of records used
    - Identify seasonal patterns (monthly averages) if enough data exists (≥10 records)
    - Identify recent trend: compare last 5 voyages against historical average
    - Return structured result: `{ avg_lead_time_days, min_days, max_days, std_dev, sample_size, recent_trend, seasonal_note, confidence: "High|Medium|Low" }`
    - Confidence rules: High = ≥10 matching records, Medium = 5–9, Low = < 5
- [ ] Create companion reference file `assets/historical-nomination-agent/app/skills/historical-analysis/references/confidence-rules.md` with the confidence threshold table

---

## Project-Specific Tasks

### MCP Translation — SAP Nomination & Transport System APIs

- [ ] Invoke `mcp-translation-file` skill for `specification/historical-nomination-agent/api-specs/SCMNominationService.edmx`
  - API ORD ID: `sap.sf:apiResource:SCMNominationService:v1`
  - API type: `edmx`
- [ ] Invoke `mcp-translation-file` skill for `specification/historical-nomination-agent/api-specs/OIL_TransportSystem.edmx`
  - API ORD ID: `sap.s4:apiResource:OP_OIL_TRANSPORTSYSTEM_0001:v1`
  - API type: `edmx`
- [ ] Invoke `setup-solution` skill to register both generated MCP server assets
- [ ] Read the generated `asset.yaml` files for both MCP servers and copy the exact `ordId` values into the agent's `asset.yaml` `requires` section

### Agent System Prompt & Tools

- [ ] Write the agent system prompt in `assets/historical-nomination-agent/app/agent.py` covering:
  - Role: "You are the Historical Nomination Agent. Your sole purpose is to analyse historical nomination records in OGS/650 and return voyage pattern statistics for a given material, route, and transport system."
  - Instruction: MUST use MCP tools to retrieve live data — never fabricate historical records
  - Instruction: set `$top=100` on all OData queries
  - Instruction: return a structured JSON result matching the schema defined in the historical-analysis skill
  - Instruction: load the `historical-analysis` SKILL.md via the `load()` tool before beginning analysis
  - Guardrail: read-only access — NEVER call any write or upsert action on OGS/650

- [ ] Implement tool: `query_historical_nominations` — queries the SCMNomination OData service filtered by material, transport system, origin location, and destination location; returns list of past nominations with dates and lead times
- [ ] Implement tool: `get_transport_system_details` — queries the OIL_TransportSystem OData service for route metadata (carrier lead time, cycle duration, location assignments) for the given transport system
- [ ] Wire MCP tool loading in `agent.py` using `get_mcp_tools()` from the `mcp_tools` module

### OGS/650 Connection

- [ ] Add environment variable references to `asset.yaml`:
  - `OGS_BASE_URL` — base URL of the OGS/650 system (placeholder: `https://your-ogs-system.com`)
  - `OGS_AUTH_TOKEN` — Bearer token or Basic auth credentials for OGS/650
- [ ] Add MCP server `requires` entries to `asset.yaml` for both generated MCP servers (SCMNomination + OIL_TransportSystem), using exact ORD IDs from generated assets

### Agent Response Schema

- [ ] Ensure the agent always returns a structured JSON payload:
  ```json
  {
    "agent": "historical-nomination-agent",
    "material": "<material>",
    "transport_system": "<ts>",
    "origin": "<origin>",
    "destination": "<destination>",
    "avg_lead_time_days": 4.1,
    "min_days": 3,
    "max_days": 6,
    "std_dev": 0.8,
    "sample_size": 12,
    "recent_trend": "stable|increasing|decreasing",
    "seasonal_note": "<optional note>",
    "confidence": "High|Medium|Low",
    "reasoning": "<plain language explanation>"
  }
  ```

---

## Business Instrumentation

- [ ] Implement structured logging for all 7 PRD milestones using pattern `[MILESTONE_ID].[achieved|missed]: [description]`:
  - `M1.achieved` / `M1.missed` — nomination detected, agent pipeline triggered
  - `M2.achieved` / `M2.missed` — historical data retrieved from OGS/650
  - `M3.achieved` / `M3.missed` — pattern analysis complete, result returned
- [ ] Add OpenTelemetry spans: extract business logic from `stream()` into `_run_analysis()` async helper; decorate with `@tracer.start_as_current_span("historical-analysis")`
- [ ] Verify `auto_instrument()` is called at top of `main.py` before any AI framework imports

---

## MCP Tool Integration

- [ ] Verify `specification/historical-nomination-agent/api-specs/` contains both `.edmx` files
- [ ] After `mcp-translation-file` completes, verify these files exist for each spec:
  - `specification/historical-nomination-agent/mcps/*/translation.json`
  - `specification/historical-nomination-agent/mcps/*/api-spec.*`
  - `specification/historical-nomination-agent/mcps/*/.tool-list.json`
- [ ] Generate `mcp-mock.json` using the `mcp-mock-config` skill

---

## Testing

- [ ] `conftest.py` only sets `IBD_TESTING=true`
- [ ] Write unit test: `test_query_historical_nominations` — mocks MCP tool returning 12 past nominations; asserts avg lead time and confidence = "High"
- [ ] Write unit test: `test_get_transport_system_details` — mocks MCP tool; asserts carrier lead time and location assignments are returned
- [ ] Write unit test: `test_low_confidence_scenario` — mocks MCP returning only 3 records; asserts confidence = "Low"
- [ ] Write integration test: full agent flow — nomination created for material CRUDE_A on route HORMUZ→ROTTERDAM; mock historical data returns 8 records; assert agent returns structured JSON with confidence = "Medium"
- [ ] Run `pytest` from `assets/historical-nomination-agent/` (no args)
- [ ] Verify coverage ≥ 70%; add tests if below threshold
- [ ] Verify `assets/historical-nomination-agent/app/agent.py` has exactly 5 decorated functions — run `grep -c "^@agent_model\|^@agent_config\|^@prompt_section" assets/historical-nomination-agent/app/agent.py` and confirm output is `5`
- [ ] Run `pytest` again (no args) to generate final `test_report.json`
- [ ] Verify `test_report.json` exists in `assets/historical-nomination-agent/`
