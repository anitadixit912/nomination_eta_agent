# Nomination ETA Proposal Agent

Multi-agent AI system for oil and gas trading that predicts nomination ETAs by combining live vessel AIS data, geopolitical & weather forecasts, and historical nomination patterns — with a human-in-the-loop approval workflow integrated into SAP OGS/650.

## Business challenge

When a cargo nomination is created in OGS/650 (SAP TSW), traders and logistics supervisors must manually estimate the ETA for the vessel. This is time-consuming, error-prone, and relies entirely on individual knowledge. There is no systematic use of live vessel position, weather/geopolitical conditions, or historical voyage patterns to inform the estimate. The absence of AI-assisted ETA proposals leads to demurrage risk, planning inefficiencies, and reactive decision-making.

## Business Goals & Success Criteria

| Metric | Baseline | Target | Timeline | Process / Capability | Source |
|--------|----------|--------|----------|----------------------|--------|
| Supervisor approval of AI-proposed ETAs (accept/reject workflow) | Manual ETA entry, no AI proposal | 100% of nominations receive an AI-proposed ETA presented for human approval | — | Nomination ETA Proposal & Approval | user |

## Key Milestones

| Milestone | Condition |
|-----------|-----------|
| Agent triggered on nomination creation | Agent detects new nomination in OGS/650 and begins analysis |
| ETA prediction generated | All 3 specialist agents have returned results and the orchestrator has produced a proposed ETA with confidence + reasoning |
| Supervisor review in Approval Queue | Proposed ETA visible in dashboard with supporting evidence |
| ETA written back to OGS/650 | Supervisor approves; ETA field updated in nomination; audit log entry created |
| Reassessment on rejection | Supervisor rejects; agent returns 2–3 alternative ETAs with reasoning |
| Ongoing vessel monitoring | Agent detects significant deviation and re-triggers ETA review |

## Business Architecture (RBA)

### End-to-End Process

Quote to Cash for Trading Business (hydrocarbon)

### Process Hierarchy

```
Quote to Cash for Trading Business (hydrocarbon) (E2E)
└── Order to Fulfill (trading business, hydrocarbon)
    └── Manage trading contracts (hydrocarbons) (BPS-S_003)
        └── Manage trading contract (purchase side)
        └── Vessel nomination creation and ETA management
        └── Marine transport scheduling and event tracking
```

### Summary

The Nomination ETA Proposal Agent sits within the Order-to-Fulfill phase of the hydrocarbon trading E2E process, specifically around vessel nomination management and marine transport scheduling — augmented with AI-assisted ETA prediction and human-in-the-loop approval.

## Fit Gap Analysis

| Requirement (business) | Standard asset(s) found | API ORD ID | MCP Server ORD ID | MCP Server Version | Gap? | Notes / assumptions |
|------------------------|-------------------------|------------|-------------------|--------------------|------|---------------------|
| Read/write nomination data in OGS/650 (TSW) | SAP TSW Nomination APIs (SOAP) | — | — | — | Yes | SOAP APIs exist (Create, Query, Read, Change TSW Nomination) but no MCP server; custom integration required |
| Nomination Management (SuccessFactors SCM) | Nomination Management OData | `sap.sf:apiResource:SCMNominationService:v1` | — | — | Yes | No MCP server found; OData + EDMX available |
| Transport system/route data | Transport System OData | `sap.s4:apiResource:OP_OIL_TRANSPORTSYSTEM_0001:v1` | — | — | Yes | No MCP server; OData available |
| Bulk transport unit/vehicle data | Bulk Transport Unit/Vehicle OData | `sap.s4:apiResource:OP_BULKTRANSPORTUNIT_0001:v1` | — | — | Yes | No MCP server; OData available |
| Live vessel position, speed, heading (AIS) | External — MarineTraffic / AIS provider | — | — | — | Yes | No SAP standard; requires AIS API integration (e.g. MarineTraffic, VesselFinder) |
| Geopolitical risk data | External — news/risk APIs | — | — | — | Yes | No SAP standard; requires external risk intelligence feed |
| Weather & ocean condition forecasts | External — weather APIs | — | — | — | Yes | No SAP standard; requires integration with weather service (e.g. Stormglass, OpenWeather) |
| Historical nomination ETA patterns | SAP OGS/650 historical data | — | — | — | Yes | Requires querying historical nomination records from OGS/650 via SOAP/OData |
| Human-in-the-loop approval queue | Existing Approval Queue UI in solution | — | — | — | No | Already exists in the current nomination approval panel |
| Audit log for ETA updates | Custom implementation | — | — | — | Yes | Needs to be built as part of the agent solution |

### Key findings

- No MCP servers exist for any of the relevant SAP TSW/OGS APIs — all integrations require custom API connectivity.
- Four OData APIs are available for nomination, transport, and bulk transport data from SAP S/4HANA and SAP SF SCM.
- TSW-specific operations (create, query, change nominations) are SOAP-based — the agent will need SOAP client capability.
- All three external data sources (AIS, geopolitical risk, weather) require third-party API integrations — no SAP standard coverage.
- The existing Approval Queue panel can be extended to display AI-proposed ETAs, reasoning, and approval actions without a full UI rebuild.
- A multi-agent orchestration pattern is the recommended approach: three specialist agents feed a central orchestrator that synthesises the ETA proposal.

## Recommendations

### Multi-Agent ETA Proposal System with Human-in-the-Loop Approval

#### Executive Summary

Four coordinated AI agents predict nomination ETAs with human approval gate in OGS/650.

#### Recommended Solution

A Python-based multi-agent system built on the A2A protocol, consisting of:

1. **Agent 1 — Historical Nomination Agent**: Queries OGS/650 historical nomination records to extract voyage patterns (average lead times, delays, seasonal trends) for the same material, route, and transport system.

2. **Agent 2 — AIS Vessel Tracking Agent**: Connects to an external AIS data provider (e.g. MarineTraffic) to fetch live vessel position, speed, heading, and port destination ETA.

3. **Agent 3 — Geopolitical & Weather Forecast Agent**: Queries external APIs for weather conditions (storms, currents, wind) and geopolitical risk factors (port closures, sanctions, conflicts) along the vessel's route.

4. **Agent 4 — ETA Orchestrator Agent (nomination-eta-agent)**: Combines outputs from the three specialist agents, calculates a weighted ETA prediction with confidence level and natural-language reasoning, and presents it to the supervisor in the Approval Queue dashboard.

**Approval workflow:**
- Supervisor sees proposed ETA + confidence + evidence → Approve (writes ETA to OGS/650) or Reject (agent performs deeper analysis → 2–3 alternatives → supervisor selects or enters manual ETA).
- Every ETA update generates an audit log entry.
- After approval, the orchestrator continues monitoring the vessel for significant deviations and re-triggers review if needed.

**Integration with OGS/650:** Via existing SOAP APIs (Create/Change/Query TSW Nomination) and OData services for transport system and bulk transport data. Connection details to be provided by the user.

#### Affected User Roles

- Logistics Supervisor / Trader — reviews and approves/rejects AI-proposed ETAs
- Operations Team — benefits from improved ETA accuracy and reduced manual entry
- System Administrator — manages API connectivity to OGS/650 and external data providers

#### Important factors

##### Human-in-the-loop control retained at all times
The agent never writes to OGS/650 without explicit supervisor approval. This ensures business decisions remain with the human, not the machine.

##### Explainability drives trust
Every ETA proposal includes a plain-language explanation of the reasoning and evidence — not just a number. This is critical for supervisor adoption.

##### Rejection feedback loop
Rejection reasons, if captured, can feed back into the historical analysis to improve prediction quality over time.

##### Continuous vessel monitoring
After the initial ETA approval, the agent keeps watching the vessel. If a significant deviation is detected (weather event, speed drop, route change), it raises a new review — turning the agent from a one-shot predictor into a continuous logistics intelligence tool.

#### Potential risks

##### OGS/650 API connectivity
The SOAP/OData integration details for OGS/650 are not yet confirmed. If the system is on-premise or behind a firewall, secure connectivity (e.g. Cloud Connector) will be required.

##### AIS data provider dependency
The quality of ETA predictions depends heavily on the freshness and accuracy of AIS data. Provider selection and licensing must be confirmed.

##### Historical data quality
If historical nomination records in OGS/650 are incomplete or inconsistently structured, the historical pattern analysis may produce unreliable baselines.

#### Recommended solution category

Python A2A Agent (multi-agent orchestration), CAP Node.js Application (Approval Queue UI extension and audit log), n8n Workflow (nomination creation trigger and event routing)

#### Intent fit
88%
