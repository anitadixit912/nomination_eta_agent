using { eta } from '../db/schema';

service NominationETAService {

  // ── Main ETA proposals ────────────────────────────────────
  entity NominationETA as projection on eta.NominationETA
    excluding { alternatives, historicalData, aisData, geoWeatherData, rejectionReason };

  // Detail projection with all evidence fields (for proposal card)
  entity NominationETADetail as projection on eta.NominationETA;

  // Audit log — read-only
  @readonly
  entity ETAAuditLog as projection on eta.ETAAuditLog;

  // ── Actions ───────────────────────────────────────────────

  /** Supervisor approves the proposed ETA */
  action approveETA(
    nominationId  : String,
    approvedETA   : DateTime,
    decisionMaker : String
  ) returns String;

  /** Supervisor rejects the proposed ETA */
  action rejectETA(
    nominationId    : String,
    rejectionReason : String,
    decisionMaker   : String
  ) returns String;

  /** Supervisor enters a manual ETA override */
  action manualOverrideETA(
    nominationId  : String,
    manualETA     : DateTime,
    decisionMaker : String
  ) returns String;
}
