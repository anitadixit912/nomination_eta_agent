namespace eta;

using { cuid, managed } from '@sap/cds/common';

// ─────────────────────────────────────────────────────────────
//  ETA Proposal — one record per nomination
// ─────────────────────────────────────────────────────────────
entity NominationETA : cuid, managed {
  nominationId      : String(50)      @mandatory;
  material          : String(40);
  transportSystem   : String(10);
  origin            : String(10);
  destination       : String(10);
  vesselMMSI        : String(20);
  vesselName        : String(60);
  proposedETA       : DateTime;
  approvedETA       : DateTime;
  status            : String(20)  default 'proposed';
    // proposed | approved | rejected | written_back | reassessing
  confidence        : String(10);
    // High | Medium | Low
  reasoning         : LargeString;
  alternatives      : LargeString;  // JSON – 3 alternatives on rejection
  rejectionReason   : String(500);
  historicalData    : LargeString;  // JSON – supporting evidence
  aisData           : LargeString;
  geoWeatherData    : LargeString;
}

// ─────────────────────────────────────────────────────────────
//  Audit Log — append-only, one row per ETA event
// ─────────────────────────────────────────────────────────────
entity ETAAuditLog : cuid {
  nominationId      : String(50)  @mandatory;
  eventType         : String(30);
    // proposed | approved | rejected | written_back | deviation_flagged | manual_override
  etaValue          : DateTime;
  decisionMaker     : String(50);
  agentReasoning    : LargeString;
  rejectionReason   : String(500);
  sourceAgents      : String(200);
  createdAt         : Timestamp  @cds.on.insert: $now;
}
