---
name: audit-logging
description: Writes a structured audit log entry to the CAP audit service for every ETA decision (approval, rejection, manual override, write-back, deviation detected).
---

# Audit Logging Skill

## Purpose

Ensure every ETA decision is recorded with full traceability for dispute resolution, compliance, and performance analysis.

## Audit Event Schema

```json
{
  "nominationId": "<nomination ID from OGS/650>",
  "eventType": "proposed | approved | rejected | written_back | deviation_flagged",
  "etaValue": "<ISO 8601 datetime of the ETA being recorded>",
  "decisionMaker": "<supervisor user ID or 'system' for automated events>",
  "agentReasoning": "<full reasoning string from the ETA proposal>",
  "rejectionReason": "<supervisor-provided reason, if applicable>",
  "sourceAgents": "historical-nomination-agent, ais-vessel-tracking-agent, geo-weather-agent"
}
```

## Instructions

### When to Write an Audit Entry

| Event | Event Type | When |
|-------|-----------|------|
| ETA proposal generated | `proposed` | After M3 milestone |
| Supervisor approves ETA | `approved` | After M4 achieved (approved) |
| ETA written to OGS/650 | `written_back` | After M5 milestone |
| Supervisor rejects ETA | `rejected` | After M4 achieved (rejected) |
| Vessel deviation detected | `deviation_flagged` | After M7 milestone |

### Step 1: Construct Payload

Build the audit log payload using the current nomination context and event type.

### Step 2: Call the CAP Audit Endpoint

Use the `write_audit_log` tool to POST to:
`{{CAP_SERVICE_URL}}/api/audit`

### Step 3: Confirm Write

If the write fails, log the error as `M5.missed` and alert the supervisor.
Never silently swallow audit write failures.
