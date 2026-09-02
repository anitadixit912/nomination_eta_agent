# Specification: nomination-eta-cap

> **Guidelines**: Read [guidelines-cap.md](../guidelines-cap.md) before executing ANY tasks below.

---

## Basic Setup

- [ ] Read `product-requirements-document.md` and `intent.md` for full context
- [ ] Invoke the `cap-development` skill from `assets/nomination-eta-cap/` to set up the CAP project structure
- [ ] Install dependencies (`npm install`), validate project starts (`cds watch`) and responds

---

## Data Model

- [ ] Define CDS entity `NominationETA` in `db/schema.cds`:
  ```
  NominationETA {
    key ID              : UUID;
    nominationId        : String(50);       // OGS/650 nomination ID
    material            : String(40);
    transportSystem     : String(10);
    origin              : String(10);
    destination         : String(10);
    vesselMMSI          : String(20);
    vesselName          : String(60);
    proposedETA         : DateTime;
    approvedETA         : DateTime;
    status              : String(20);       // proposed | approved | rejected | written_back
    confidence          : String(10);       // High | Medium | Low
    reasoning           : LargeString;
    alternatives        : LargeString;      // JSON string of 3 alternatives on rejection
    createdAt           : Timestamp @cds.on.insert: $now;
    updatedAt           : Timestamp @cds.on.update: $now;
  }
  ```

- [ ] Define CDS entity `ETAAuditLog` in `db/schema.cds`:
  ```
  ETAAuditLog {
    key ID              : UUID;
    nominationId        : String(50);
    eventType           : String(30);       // proposed | approved | rejected | written_back | deviation_flagged
    etaValue            : DateTime;
    decisionMaker       : String(50);
    agentReasoning      : LargeString;
    rejectionReason     : String(500);
    sourceAgents        : String(200);      // comma-separated list of contributing agents
    timestamp           : Timestamp @cds.on.insert: $now;
  }
  ```

---

## Service Layer

- [ ] Define CDS service `NominationETAService` in `srv/service.cds` exposing:
  - `NominationETA` — full CRUD for proposals and status updates
  - `ETAAuditLog` — read-only access
  - Action `approveETA(nominationId: String, approvedETA: DateTime, decisionMaker: String)` — updates status to "approved", triggers OGS/650 write-back via SOAP stub, creates audit log entry
  - Action `rejectETA(nominationId: String, rejectionReason: String, decisionMaker: String)` — updates status to "rejected", creates audit log entry, triggers re-analysis request to orchestrator agent
  - Action `manualOverrideETA(nominationId: String, manualETA: DateTime, decisionMaker: String)` — supervisor enters a manual ETA; writes directly to OGS/650, creates audit log entry

- [ ] Implement custom handler `srv/nomination-eta-handler.js`:
  - `approveETA` handler: validate input → update `NominationETA.status` → call OGS/650 SOAP stub (`writeETAToNomination`) → create `ETAAuditLog` entry with eventType "approved"
  - `rejectETA` handler: validate → update status → create audit log entry (eventType "rejected") → POST to orchestrator agent `/reassess` endpoint
  - `manualOverrideETA` handler: validate → call OGS/650 SOAP stub → create audit log entry (eventType "written_back")
  - OGS/650 SOAP stub: implement as a configurable HTTP call to `OGS_SOAP_URL` with Basic auth — use placeholder implementation that logs the call in dev mode

---

## API Endpoints for Agent Integration

- [ ] Expose REST endpoint `POST /api/nominations` — called by n8n trigger workflow when a new nomination is created in OGS/650; stores nomination metadata and triggers orchestrator agent
- [ ] Expose REST endpoint `POST /api/nominations/:id/proposal` — called by orchestrator agent to store ETA proposal; updates `NominationETA` record with proposed ETA, reasoning, confidence, and alternatives
- [ ] Expose REST endpoint `GET /api/nominations/:id/proposal` — called by Approval Queue UI to fetch the current ETA proposal for display
- [ ] Expose REST endpoint `POST /api/nominations/:id/refresh` — triggers a fresh ETA analysis for an existing nomination (on-demand "Refresh ETA" button)
- [ ] Expose REST endpoint `POST /api/audit` — called by orchestrator agent to write audit log entries

---

## UI — Approval Queue Extension

- [ ] Scaffold React frontend in `assets/nomination-eta-cap/ui/` using SAP UI5 Web Components
- [ ] Build `ApprovalQueue` page showing a table of nominations with columns:
  - Nomination ID, Material, Route (Origin → Destination), Vessel Name/MMSI, Proposed ETA, Confidence, Status, Actions
- [ ] Build `ETAProposalCard` component for each nomination showing:
  - Proposed ETA date/time with confidence badge (colour-coded: High=green, Medium=amber, Low=red)
  - Reasoning text (plain language from orchestrator agent)
  - Supporting evidence panel: Historical (avg lead time, sample size), AIS (distance, speed), Geo/Weather (risk level, delay days)
  - **Approve** button → calls `approveETA` action
  - **Reject** button → opens rejection dialog with optional reason text field
  - **Refresh ETA** button → calls `/refresh` endpoint
- [ ] Build `AlternativesPanel` component — shown after rejection, displays 3 alternative ETAs:
  - Each shows: label (Optimistic/Baseline/Conservative), ETA date, confidence, reasoning
  - Radio button to select one alternative
  - "Accept Selected" button → calls `approveETA` with selected alternative ETA
  - "Enter Manual ETA" date picker → calls `manualOverrideETA`
- [ ] Build `AuditLogView` page — table of all `ETAAuditLog` entries filterable by nomination ID; shows eventType, ETA value, decision maker, timestamp, and reasoning
- [ ] Connect all UI components to the CAP OData V4 service endpoints

---

## Mock Data

- [ ] Create `db/data/NominationETA.csv` with 5 sample nominations in various statuses (proposed, approved, rejected) for dev/test
- [ ] Create `db/data/ETAAuditLog.csv` with corresponding audit entries

---

## Testing

- [ ] Run `cds compile srv/` to validate CDS models compile without errors
- [ ] Write test for `approveETA` handler: given a proposed nomination, when approved, assert status = "approved" and audit log entry created
- [ ] Write test for `rejectETA` handler: given a proposed nomination, when rejected with reason, assert status = "rejected" and audit log entry has rejectionReason populated
- [ ] Write test for `manualOverrideETA` handler: given a rejected nomination, when manual ETA provided, assert audit log entry with eventType = "written_back"
- [ ] Run `cds watch` and verify:
  - `GET /odata/v4/NominationETAService/NominationETA` returns 200
  - `GET /odata/v4/NominationETAService/ETAAuditLog` returns 200
  - `POST /api/nominations` returns 201
- [ ] Verify all custom handler logic is covered by tests (no untested branches)
