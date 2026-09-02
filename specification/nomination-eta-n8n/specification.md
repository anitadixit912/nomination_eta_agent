# Specification: nomination-eta-n8n

> **Guidelines**: Read [guidelines-n8n-workflow.md](../guidelines-n8n-workflow.md) before executing ANY tasks below.

---

## Basic Setup

- [ ] Read `product-requirements-document.md` and `intent.md` for full context
- [ ] Create `assets/n8n/workflows/` directory

---

## Workflow 1: Nomination Created — Trigger ETA Analysis

**File**: `assets/n8n/workflows/nomination-created-trigger.n8n.json`

- [ ] Build workflow with the following nodes in order:

  1. **Webhook** (trigger) — `POST /webhook/nomination-created`
     - Receives nomination creation payload from OGS/650:
       `{ nomination_id, material, transport_system, origin, destination, vessel_mmsi, vessel_name, vessel_imo }`
     - Method: POST
     - Authentication: none (user assigns credentials in n8n UI after import)

  2. **HTTP Request** — `Store Nomination in CAP`
     - Method: POST
     - URL: `https://nomination-eta-cap.company.com/api/nominations`
     - Body: forward full webhook payload as JSON

  3. **HTTP Request** — `Trigger ETA Orchestrator Agent`
     - Method: POST
     - URL: `https://nomination-eta-agent.company.com/invoke`
     - Body:
       ```json
       {
         "message": "New nomination created. Please analyse ETA for nomination_id={{$json.nomination_id}}, material={{$json.material}}, transport_system={{$json.transport_system}}, origin={{$json.origin}}, destination={{$json.destination}}, vessel_mmsi={{$json.vessel_mmsi}}",
         "context_id": "={{$json.nomination_id}}"
       }
       ```

  4. **HTTP Request** — `Store ETA Proposal in CAP`
     - Method: POST
     - URL: `https://nomination-eta-cap.company.com/api/nominations/{{$json.nomination_id}}/proposal`
     - Body: agent response (proposed ETA, confidence, reasoning, supporting_evidence)

  5. **Respond to Webhook** — return `{ status: "eta_analysis_triggered", nomination_id }` with HTTP 200

- [ ] Validate JSON is well-formed
- [ ] Ensure all node `connections` reference nodes by `name`, not `id`
- [ ] No credentials blocks in the JSON

---

## Workflow 2: Vessel Deviation Monitor — Re-trigger ETA Review

**File**: `assets/n8n/workflows/vessel-deviation-monitor.n8n.json`

- [ ] Build workflow with the following nodes:

  1. **Schedule Trigger** — runs every 6 hours
     - Cron: `0 */6 * * *`

  2. **HTTP Request** — `Fetch Active Nominations`
     - Method: GET
     - URL: `https://nomination-eta-cap.company.com/odata/v4/NominationETAService/NominationETA?$filter=status eq 'approved'`

  3. **Split In Batches** — iterate over each approved nomination

  4. **HTTP Request** — `Check AIS Agent for Deviation`
     - Method: POST
     - URL: `https://ais-vessel-tracking-agent.company.com/invoke`
     - Body:
       ```json
       {
         "message": "Check for vessel deviation. vessel_mmsi={{$json.vesselMMSI}}, nomination_id={{$json.nominationId}}, approved_eta={{$json.approvedETA}}, destination={{$json.destination}}",
         "context_id": "deviation-check-={{$json.nominationId}}"
       }
       ```

  5. **IF** — `Significant Deviation Detected?`
     - Condition: agent response contains `deviation_detected: true`
     - True branch → continues to re-trigger
     - False branch → no action (loop continues)

  6. **HTTP Request** — `Trigger Re-Analysis` (True branch only)
     - Method: POST
     - URL: `https://nomination-eta-cap.company.com/api/nominations/{{$json.nominationId}}/refresh`
     - Body: `{ "reason": "vessel_deviation", "deviation_detail": "={{$json.deviation_detail}}" }`

  7. **HTTP Request** — `Notify Approval Queue` (True branch only)
     - Method: POST
     - URL: `https://nomination-eta-cap.company.com/api/audit`
     - Body: `{ "nominationId": "={{$json.nominationId}}", "eventType": "deviation_flagged", "agentReasoning": "={{$json.reasoning}}" }`

- [ ] Validate JSON is well-formed
- [ ] No credentials blocks in the JSON

---

## Workflow 3: On-Demand Refresh ETA

**File**: `assets/n8n/workflows/refresh-eta-on-demand.n8n.json`

- [ ] Build workflow:

  1. **Webhook** (trigger) — `POST /webhook/refresh-eta`
     - Payload: `{ nomination_id, requested_by }`

  2. **HTTP Request** — `Fetch Nomination Details from CAP`
     - GET `https://nomination-eta-cap.company.com/odata/v4/NominationETAService/NominationETA?$filter=nominationId eq '{{$json.nomination_id}}'`

  3. **HTTP Request** — `Trigger ETA Orchestrator Agent`
     - POST to `https://nomination-eta-agent.company.com/invoke`
     - Body includes full nomination context from step 2 response

  4. **HTTP Request** — `Store Updated Proposal in CAP`
     - POST to `/api/nominations/{{$json.nomination_id}}/proposal`

  5. **Respond to Webhook** — return `{ status: "eta_refreshed", nomination_id }` with HTTP 200

- [ ] Validate JSON is well-formed
- [ ] No credentials blocks in the JSON

---

## Asset Configuration

- [ ] Write `assets/n8n/asset.yaml`:
  ```yaml
  apiVersion: asset.sap/v1
  kind: Asset
  type: n8n-workflow
  metadata:
    name: nomination-eta-n8n
  components:
    - name: workflows
      sourceRoot: workflows
      workflows:
        - nomination-created-trigger.n8n.json
        - vessel-deviation-monitor.n8n.json
        - refresh-eta-on-demand.n8n.json
  ```

## Validation

- [ ] Run JSON validation on all 3 workflow files: `node -e "JSON.parse(require('fs').readFileSync('assets/n8n/workflows/nomination-created-trigger.n8n.json','utf8')); console.log('valid')"`
- [ ] Confirm no `credentials` blocks appear in any workflow JSON: `grep -r '"credentials"' assets/n8n/workflows/` should return nothing
- [ ] Confirm all connections reference nodes by `name` not raw `id` UUIDs
