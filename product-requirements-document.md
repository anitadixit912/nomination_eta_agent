# Product Requirements Document (PRD)

**Title:** Nomination ETA Proposal Agent  
**Date:** 2026-09-02  
**Owner:** Trading & Logistics Operations  
**Solution Category:** AI Agent (Multi-Agent, Python A2A) + CAP Node.js Application (Approval Queue UI) + n8n Workflow (Event Trigger)

---

## Product Purpose & Value Proposition

**Elevator Pitch:**  
When a cargo nomination is created in OGS/650, supervisors must manually estimate when the vessel will arrive — with no AI support, no live vessel data, and no systematic use of history. This agent changes that: it automatically proposes an ETA, explains its reasoning, and waits for the supervisor to approve or reject — putting intelligence in the loop without removing human control.

**Business Need:**  
Logistics supervisors in oil & gas trading currently set ETAs based on experience and intuition. There is no integration of live vessel position (AIS), geopolitical risk, weather conditions, or historical voyage patterns into the estimation process. This leads to inaccurate ETAs, demurrage exposure, and reactive replanning.

**Expected Value:**  
- Every nomination receives an AI-proposed ETA with supporting evidence before any human decision is made.  
- Supervisors spend less time researching ETAs manually.  
- Over time, rejection feedback improves prediction quality.  
- Continuous vessel monitoring triggers re-review when conditions change — turning the system into a live logistics intelligence layer.

**Product Objectives (Prioritized):**
1. Every new nomination automatically receives an AI-proposed ETA presented for human approval — before any manual input is required.
2. Every ETA proposal includes a plain-language explanation of reasoning, confidence level, and supporting evidence.
3. On rejection, the agent performs a deeper analysis and offers 2–3 alternative ETAs with separate reasoning, enabling an informed supervisor decision.
4. After approval, the agent continuously monitors the vessel and triggers re-review on significant deviation.

---

## Business Metrics

| Metric | Baseline | Target | Timeline | Process / Capability | Source |
|--------|----------|--------|----------|----------------------|--------|
| Supervisor approval of AI-proposed ETAs (accept/reject workflow) | Manual ETA entry, no AI proposal | 100% of nominations receive an AI-proposed ETA presented for human approval | — | Nomination ETA Proposal & Approval | user |

---

## User Profiles & Personas

### Primary Persona: Marco — Logistics Supervisor

Marco is a 42-year-old logistics supervisor at a commodity trading company. He oversees 15–30 active nominations at any time, each involving marine vessels transporting crude oil or refined products across global routes. Every morning he opens the nomination queue and manually checks ETAs, cross-referencing vessel schedules, weather reports, and port intelligence from multiple sources. He's been doing this for 12 years and knows the routes well — but the sheer volume of nominations and last-minute changes means he occasionally misses a deviation until it's too late. He trusts his experience but would welcome an intelligent assistant that does the initial legwork and surfaces the right data, as long as he stays in control of the final call.

**Pain points:**
- Manual ETA estimation is time-consuming and error-prone at scale.
- No structured way to incorporate live vessel data or weather risk into the estimate.
- Corrections happen reactively — after a delay is already developing.

### Secondary Persona: Aisha — Trading Operations Analyst

Aisha supports the trading desk by monitoring nomination status and flagging operational risks. She needs to see where ETAs have been proposed, approved, changed, or rejected — and why. She uses audit trails to investigate demurrage disputes and to prepare operational performance reports.

### Other User Types

- **System Administrator**: Manages API credentials for OGS/650, MarineTraffic, weather and geopolitical data providers.
- **Trader**: Receives alerts when an ETA deviation is flagged; may need to adjust contract terms or logistics.

---

## Goals and Non-Goals

### Goals (In Scope)

- Automatically trigger the ETA proposal workflow when a nomination is created in OGS/650.
- Propose an ETA using a combination of: historical nomination patterns (Agent 3), live AIS vessel data (Agent 2), and geopolitical & weather risk (Agent 1).
- Present the proposed ETA, confidence level, and reasoning to the supervisor in the Approval Queue.
- Support approve / reject flows: on approval, write ETA back to OGS/650 and record an audit log entry; on rejection, offer 2–3 alternatives with reasoning.
- Continuously monitor vessel movement after approval and flag re-review on significant deviation.
- Capture rejection reasons to enable future improvement of prediction logic.
- Provide a "Refresh ETA" button in the Approval Queue for on-demand re-analysis.

### Non-Goals (Out of Scope)

- Fully autonomous ETA updates without supervisor approval.
- Replacement of the existing Approval Queue — the agent extends it, not replaces it.
- Demurrage claim management or financial settlement.
- Direct vessel route planning or scheduling.
- Integration with non-OGS/650 nomination systems (out of initial scope).

---

## Requirements

### Must-Have Requirements

**REQ-01**: Automatic ETA Proposal on Nomination Creation

- **Problem to Solve**: Supervisors must manually estimate ETAs without AI support, leading to inconsistency and delay.
- **User Story**: As a Logistics Supervisor, I need an AI-proposed ETA to appear in the Approval Queue immediately after a nomination is created, so that I can make an informed decision quickly without manual research.
- **Acceptance Criteria**:
  - Given a new nomination is created in OGS/650, when the agent detects it, then an ETA proposal with confidence level and reasoning is available in the Approval Queue within a defined SLA (target: under 2 minutes).
- **Maps to Objective**: 1
- **Priority Rank**: 1

---

**REQ-02**: Three-Agent Intelligence Pipeline

- **Problem to Solve**: A single data source (e.g. averages only) produces unreliable ETAs; accurate predictions require multiple independent inputs.
- **User Story**: As a Logistics Supervisor, I need the proposed ETA to draw on live vessel position, weather/geopolitical risk, and historical voyage patterns, so that I can trust the reasoning behind the proposal.
- **Acceptance Criteria**:
  - Given a nomination exists, when the orchestrator agent runs, then it has consumed outputs from all three specialist agents: (1) Historical Nomination Agent, (2) AIS Vessel Tracking Agent, (3) Geopolitical & Weather Forecast Agent.
  - Each agent's contribution is visible in the reasoning summary shown to the supervisor.
- **Maps to Objective**: 2
- **Priority Rank**: 2

---

**REQ-03**: Human Approval Gate — Approve / Reject Flow

- **Problem to Solve**: Business decisions on ETA must remain with the supervisor; the agent must not write to OGS/650 without approval.
- **User Story**: As a Logistics Supervisor, I need to approve or reject the proposed ETA, so that I retain control over the nomination data written to OGS/650.
- **Acceptance Criteria**:
  - Given a proposed ETA is shown, when the supervisor clicks Approve, then the ETA is written to the nomination in OGS/650 and an audit log entry is created.
  - Given the supervisor clicks Reject, then the agent performs a deeper analysis and returns 2–3 alternative ETAs, each with independent reasoning and confidence level.
  - The supervisor can select an alternative or enter a manual ETA; the chosen ETA is then written to OGS/650.
- **Maps to Objective**: 1, 2, 3
- **Priority Rank**: 3

---

**REQ-04**: Audit Log for All ETA Writes

- **Problem to Solve**: Analysts and operations teams need a traceable record of every ETA decision for dispute resolution and performance review.
- **User Story**: As a Trading Operations Analyst, I need an audit log entry for every ETA written to OGS/650, so that I can reconstruct the decision history for any nomination.
- **Acceptance Criteria**:
  - Every write to the ETA field in OGS/650 produces an audit log record containing: nomination ID, proposed ETA, approved ETA, decision (approved/rejected), decision maker, timestamp, and agent reasoning summary.
- **Maps to Objective**: 1
- **Priority Rank**: 4

---

**REQ-05**: Continuous Vessel Monitoring and Deviation Alert

- **Problem to Solve**: ETAs can become stale after approval if vessel conditions change; supervisors need to be prompted to re-evaluate.
- **User Story**: As a Logistics Supervisor, I need to be notified when the vessel deviates significantly from its expected path or ETA, so that I can re-evaluate and update the nomination before a problem develops.
- **Acceptance Criteria**:
  - Given an approved ETA exists, when the AIS data shows a significant deviation (e.g. speed drop >20%, heading change indicating port diversion, or weather event on route), then a re-review is triggered and a new ETA proposal appears in the Approval Queue.
- **Maps to Objective**: 4
- **Priority Rank**: 5

---

**REQ-06**: On-Demand ETA Refresh

- **Problem to Solve**: Supervisors sometimes want to re-run the analysis without waiting for an automated trigger.
- **User Story**: As a Logistics Supervisor, I need a "Refresh ETA" button in the Approval Queue, so that I can request an updated ETA analysis at any time.
- **Acceptance Criteria**:
  - Given a nomination with an existing ETA, when the supervisor clicks Refresh ETA, then a new ETA proposal is generated using the latest AIS, weather, and historical data and presented for approval.
- **Maps to Objective**: 1
- **Priority Rank**: 6

---

## Solution Architecture

**Architecture Overview:**  
A multi-agent Python A2A system orchestrates three specialist agents whose outputs are synthesised by a central ETA Orchestrator. The Orchestrator presents results through an extended Approval Queue UI (CAP + React). An n8n workflow handles the nomination creation trigger from OGS/650 and routes events to the agent pipeline. OGS/650 is accessed via its SOAP APIs for nomination read/write and OData services for transport and bulk transport data.

**Key Components:**

- **Agent 1 — Geopolitical & Weather Forecast Agent**: Queries external weather APIs (e.g. Stormglass) and geopolitical risk feeds for the vessel's route. Returns risk factors and estimated delay impact.
- **Agent 2 — AIS Vessel Tracking Agent**: Connects to MarineTraffic or equivalent AIS provider to retrieve live vessel position, speed, heading, and remaining distance to destination. Calculates estimated sailing time.
- **Agent 3 — Historical Nomination Agent**: Queries historical nomination records from OGS/650 to extract average lead times, delay patterns, and seasonal trends for the same material, route, and transport system.
- **Agent 4 — ETA Orchestrator (nomination-eta-agent)**: Receives outputs from Agents 1–3, applies weighted reasoning to produce a final ETA proposal with confidence score and natural-language explanation. On rejection, performs deeper analysis and generates 2–3 alternatives.
- **CAP Node.js Application**: Provides the Approval Queue UI extension and backend service for audit log persistence. The UI is built in React with SAP UI5 Web Components.
- **n8n Workflow**: Listens for nomination creation events from OGS/650 (via webhook or polling), triggers the agent pipeline, and routes approval/rejection actions.

**Integration Points:**

- **OGS/650 (SAP TSW)**: SOAP APIs — Create, Read, Change, Query TSW Nomination; OData — Transport System, Bulk Transport Unit, Bulk Transport Vehicle. Connection details to be provided.
- **AIS Provider (MarineTraffic or equivalent)**: REST API — live vessel position, speed, heading, ETA. Requires API key.
- **Weather API (e.g. Stormglass)**: REST API — route-level weather and ocean conditions.
- **Geopolitical Risk Feed (e.g. ACLED, news aggregator)**: REST API — port/region risk scoring.

---

### Agent Extensibility & Instrumentation

**Agent Extensibility:**
- Each specialist agent (Historical, AIS, Geopolitical/Weather) is independently deployable and callable, allowing individual replacement or upgrade without affecting the orchestrator.
- The orchestrator accepts a standard agent response schema; new specialist agents can be added to the pipeline by registering them with the orchestrator configuration.
- Rejection reason capture is designed as an optional field from day one, ready to feed a future feedback/fine-tuning loop.

**Business Step Instrumentation:**
All key business steps emit structured log statements following the pattern: `[MILESTONE_ID].[achieved|missed]: [description]`

---

### Automation & Agent Behaviour

**Automation Level:** Hybrid — AI-assisted prediction with mandatory human approval gate for all writes to OGS/650.

**Actions the system performs without human approval:**
- Fetch live vessel position from AIS provider.
- Query historical nomination records from OGS/650.
- Query weather and geopolitical risk data from external providers.
- Calculate ETA prediction and generate reasoning summary.
- Detect vessel deviation and trigger re-review notification.

**Actions that require human review or approval:**
- Writing ETA data to a nomination in OGS/650.
- Writing any updated event dates (loading, discharge) to a nomination.

**Model or engine used:** Python A2A agent framework; LLM via SAP Generative AI Hub for reasoning synthesis and natural-language explanation generation.

**Knowledge & data sources accessed:**

- OGS/650 historical nomination records — voyage history, lead times (read-only).
- AIS provider — live vessel telemetry (read-only).
- Weather API — route weather and ocean conditions (read-only).
- Geopolitical risk feed — port/region risk data (read-only).

**Tools or connectors invoked:**

- OGS/650 SOAP/OData client — read nominations, transport systems, bulk transport data (read-only during analysis; write only on supervisor approval).
- AIS REST client — fetch vessel position and ETA (read-only).
- Weather REST client — fetch route conditions (read-only).
- Geopolitical risk REST client — fetch risk scores (read-only).

**Guardrails & fail-safes:**

- The agent NEVER writes to OGS/650 without an explicit supervisor approval action.
- If any specialist agent fails to return data, the orchestrator still produces a proposal from the available inputs and clearly indicates which source is missing.
- If all three specialist agents fail, the orchestrator presents a "Insufficient data" notice and routes to manual ETA entry.
- Confidence thresholds: proposals below a defined confidence level are flagged with a warning and a recommendation to review manually.

---

## Milestones

### M1: Nomination Detected

- **Description**: A new nomination is created in OGS/650 and the agent pipeline is triggered.
- **Achieved when**: The n8n workflow receives the nomination creation event and successfully dispatches the task to the ETA Orchestrator.
- **Log on achievement**: `M1.achieved: nomination detected and agent pipeline triggered — nomination_id={id}`
- **Log on miss**: `M1.missed: nomination creation event not received or pipeline dispatch failed — nomination_id={id}`

### M2: Specialist Agent Data Collected

- **Description**: All three specialist agents (Historical, AIS, Geopolitical/Weather) have returned their outputs to the orchestrator.
- **Achieved when**: Orchestrator has received valid responses from all three agents.
- **Log on achievement**: `M2.achieved: all specialist agents returned data — agents=[historical, ais, geo_weather]`
- **Log on miss**: `M2.missed: one or more specialist agents failed to return data — failed_agents={list}`

### M3: ETA Proposal Generated

- **Description**: The orchestrator has produced a proposed ETA with confidence level and natural-language reasoning.
- **Achieved when**: ETA proposal object is written to the Approval Queue and visible to the supervisor.
- **Log on achievement**: `M3.achieved: ETA proposal generated — nomination_id={id}, proposed_eta={eta}, confidence={score}`
- **Log on miss**: `M3.missed: ETA proposal generation failed — nomination_id={id}, reason={reason}`

### M4: Supervisor Decision Received

- **Description**: The supervisor has acted on the ETA proposal (approved or rejected).
- **Achieved when**: An approve or reject action is recorded against the proposal.
- **Log on achievement**: `M4.achieved: supervisor decision recorded — nomination_id={id}, decision={approved|rejected}`
- **Log on miss**: `M4.missed: no supervisor decision received within SLA — nomination_id={id}`

### M5: ETA Written to OGS/650

- **Description**: The approved ETA is written back to the nomination in OGS/650 and an audit log entry is created.
- **Achieved when**: OGS/650 SOAP write call succeeds and audit log record is persisted.
- **Log on achievement**: `M5.achieved: ETA written to OGS/650 and audit log created — nomination_id={id}, eta={eta}`
- **Log on miss**: `M5.missed: ETA write to OGS/650 failed — nomination_id={id}, reason={reason}`

### M6: Reassessment on Rejection

- **Description**: After a rejection, the agent performs deeper analysis and returns 2–3 alternative ETA proposals.
- **Achieved when**: 2–3 alternative ETAs with individual reasoning are presented to the supervisor.
- **Log on achievement**: `M6.achieved: reassessment complete, alternatives presented — nomination_id={id}, alternatives_count={n}`
- **Log on miss**: `M6.missed: reassessment failed to produce alternatives — nomination_id={id}, reason={reason}`

### M7: Vessel Deviation Detected

- **Description**: Post-approval monitoring detects a significant vessel deviation and triggers a re-review.
- **Achieved when**: AIS monitoring detects a defined threshold deviation and a new ETA proposal is queued for supervisor review.
- **Log on achievement**: `M7.achieved: vessel deviation detected, re-review triggered — nomination_id={id}, deviation_type={type}`
- **Log on miss**: `M7.missed: deviation detection check failed — nomination_id={id}, reason={reason}`

---

## Risks, Assumptions, and Dependencies

### Risks

- **OGS/650 connectivity**: Connection details not yet confirmed; on-premise system may require SAP Cloud Connector for secure BTP access.
- **AIS data quality**: ETA accuracy depends on freshness and completeness of AIS data; provider selection and licensing must be confirmed.
- **Historical data completeness**: If past nomination records in OGS/650 are incomplete or inconsistently structured, historical predictions may be unreliable in early deployments.
- **LLM reasoning quality**: The natural-language explanation depends on the LLM; low-quality explanations may reduce supervisor trust.

### Assumptions

- OGS/650 exposes SOAP and OData endpoints accessible from SAP BTP (directly or via Cloud Connector).
- An AIS data provider account (e.g. MarineTraffic) will be made available with suitable API access.
- The existing Approval Queue UI can be extended with new columns/panels without a full rebuild.
- Historical nomination records in OGS/650 contain sufficient voyage history (material, route, transport system, dates) for pattern analysis.

### Dependencies

- OGS/650 API credentials and connectivity details (to be provided by the user).
- AIS provider API key and subscription tier.
- Weather and geopolitical risk API keys.
- SAP Generative AI Hub access for LLM reasoning layer.

---

## Appendix

### Glossary

| Term | Definition |
|------|------------|
| ETA | Estimated Time of Arrival — the predicted date/time a vessel will reach its destination port |
| AIS | Automatic Identification System — maritime tracking system broadcasting vessel position, speed, and heading |
| OGS/650 | SAP Oil & Gas system, incorporating TSW (Trading & Supply Web) for nomination management |
| TSW | Trading & Supply Web — SAP module within OGS for managing hydrocarbon nominations and transport |
| Nomination | A formal record in OGS/650 capturing vessel, material, origin, destination, and scheduled dates for a cargo movement |
| Demurrage | Financial penalty incurred when a vessel is delayed beyond the agreed loading/discharge time |
| A2A | Agent-to-Agent protocol — the communication framework used between Python AI agents in this solution |

### References

- SAP TSW Nomination SOAP APIs: Change, Create, Query, Read TSW Nomination
- SAP OData APIs: Nomination Management (`sap.sf:apiResource:SCMNominationService:v1`), Transport System (`sap.s4:apiResource:OP_OIL_TRANSPORTSYSTEM_0001:v1`), Bulk Transport Unit (`sap.s4:apiResource:OP_BULKTRANSPORTUNIT_0001:v1`), Bulk Transport Vehicle (`sap.s4:apiResource:OP_BULKTRANSPORTVEHICLE_0001:v1`)
- SAP S/4HANA Cloud Private Edition — Trade Management capability (SC5159)
- SAP Generative AI Hub — LLM runtime for reasoning synthesis
