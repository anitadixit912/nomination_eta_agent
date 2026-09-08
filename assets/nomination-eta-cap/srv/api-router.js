/**
 * REST API endpoints for agent integration — extends the CAP server
 * with /api/* routes used by the ETA Orchestrator and n8n workflows.
 */
import cds from '@sap/cds';
import { callViaDestination } from './destination-helper.js';

const LOG = cds.log('api-router');

// Shared function to fetch open nominations from S/4HANA
export async function _fetchFromS4() {
  const response = await callViaDestination(
    'OGS_S4',
    '/sap/opu/odata/sap/TSW_MYNOMINATIONS_SRV_01/NominationSet?$filter=Status%20eq%20%27OPEN%27&$format=json'
  );
  return response?.d?.results || [];
}

export function registerApiRoutes(app) {

  // ── POST /api/nominations ──────────────────────────────────
  // Called by n8n when a new nomination is created in OGS/650
  app.post('/api/nominations', async (req, res) => {
    try {
      const { NominationETA } = cds.db.model.entities('eta');
      const body = req.body;

      // Upsert: create or update the nomination record
      const existing = await SELECT.one.from(NominationETA)
        .where({ nominationId: body.nomination_id });

      if (existing) {
        await UPDATE(NominationETA, existing.ID).with({
          material: body.material,
          transportSystem: body.transport_system,
          origin: body.origin,
          destination: body.destination,
          vesselMMSI: body.vessel_mmsi,
          vesselName: body.vessel_name,
          status: 'proposed'
        });
        res.status(200).json({ id: existing.ID, status: 'updated' });
      } else {
        const { ID } = await INSERT.into(NominationETA).entries({
          nominationId: body.nomination_id,
          material: body.material,
          transportSystem: body.transport_system,
          origin: body.origin,
          destination: body.destination,
          vesselMMSI: body.vessel_mmsi,
          vesselName: body.vessel_name || '',
          status: 'proposed'
        });
        res.status(201).json({ id: ID, status: 'created' });
      }
    } catch (e) {
      LOG.error('POST /api/nominations failed:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/nominations/:id/proposal ────────────────────
  // Called by the orchestrator agent to store the ETA proposal
  app.post('/api/nominations/:id/proposal', async (req, res) => {
    try {
      const { NominationETA, ETAAuditLog } = cds.db.model.entities('eta');
      const nominationId = req.params.id;
      const body = req.body;

      const existing = await SELECT.one.from(NominationETA)
        .where({ nominationId });
      if (!existing) return res.status(404).json({ error: 'Nomination not found' });

      await UPDATE(NominationETA, existing.ID).with({
        proposedETA: body.proposed_eta_utc,
        confidence: body.confidence,
        reasoning: body.reasoning,
        status: 'proposed',
        alternatives: body.alternatives ? JSON.stringify(body.alternatives) : null,
        historicalData: body.supporting_evidence?.historical
          ? JSON.stringify(body.supporting_evidence.historical) : null,
        aisData: body.supporting_evidence?.ais
          ? JSON.stringify(body.supporting_evidence.ais) : null,
        geoWeatherData: body.supporting_evidence?.geo_weather
          ? JSON.stringify(body.supporting_evidence.geo_weather) : null
      });

      await INSERT.into(ETAAuditLog).entries({
        nominationId,
        eventType: 'proposed',
        etaValue: body.proposed_eta_utc,
        decisionMaker: 'system',
        agentReasoning: body.reasoning,
        sourceAgents: 'historical-nomination-agent, ais-vessel-tracking-agent, geo-weather-agent'
      });

      LOG.info(`[M3.achieved]: ETA proposal stored — nominationId=${nominationId}`);
      res.status(200).json({ status: 'proposal_stored', nominationId });
    } catch (e) {
      LOG.error('POST /api/nominations/:id/proposal failed:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/nominations/:id/proposal ─────────────────────
  // Called by Approval Queue UI to fetch the current proposal
  app.get('/api/nominations/:id/proposal', async (req, res) => {
    try {
      const { NominationETA } = cds.db.model.entities('eta');
      const nominationId = req.params.id;
      const record = await SELECT.one.from(NominationETA).where({ nominationId });
      if (!record) return res.status(404).json({ error: 'Not found' });
      res.json(record);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/nominations/:id/refresh ─────────────────────
  // Triggers fresh ETA analysis (Refresh ETA button)
  app.post('/api/nominations/:id/refresh', async (req, res) => {
    try {
      const { NominationETA } = cds.db.model.entities('eta');
      const nominationId = req.params.id;
      const record = await SELECT.one.from(NominationETA).where({ nominationId });
      if (!record) return res.status(404).json({ error: 'Not found' });

      await UPDATE(NominationETA, record.ID).with({ status: 'proposed' });

      LOG.info(`ETA refresh requested for nominationId=${nominationId}`);
      res.json({ status: 'refresh_triggered', nominationId });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/s4-metadata ── TEMPORARY DEBUG ───────────────
  app.get('/api/s4-metadata', async (req, res) => {
    try {
      const result = await callViaDestination('OGS_S4', '/sap/opu/odata/sap/TSW_MYNOMINATIONS_SRV_01/$metadata', { headers: { 'Accept': 'application/xml' } });
      res.set('Content-Type', 'text/xml');
      res.send(typeof result === 'string' ? result : JSON.stringify(result));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/fetch-nominations ───────────────────────────
  // Manually trigger a fetch from S/4HANA via BTP Destination
  app.post('/api/fetch-nominations', async (req, res) => {
    try {
      const nominations = await _fetchFromS4();
      const { NominationETA } = cds.db.model.entities('eta');
      let created = 0;

      for (const n of nominations) {
        const nominationId = n.NominationID || n.Nomination || n.ID;
        if (!nominationId) continue;
        const existing = await SELECT.one.from(NominationETA).where({ nominationId });
        if (!existing) {
          await INSERT.into(NominationETA).entries({
            nominationId,
            material: n.Material || n.MaterialDescription || '',
            transportSystem: n.TransportationSystem || n.TranspSystem || '',
            origin: n.LoadingLocation || n.OriginLocation || '',
            destination: n.DischargeLocation || n.DestinationLocation || '',
            vesselMMSI: n.VesselMMSI || n.Vessel || '',
            vesselName: n.VesselName || '',
            status: 'proposed'
          });
          created++;
        }
      }

      LOG.info(`Manual fetch: ${nominations.length} found, ${created} new nominations created`);
      res.json({ fetched: nominations.length, created });
    } catch (e) {
      LOG.error('Manual S/4HANA fetch failed:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/audit ────────────────────────────────────────
  // Called by agents to write audit log entries directly
  app.post('/api/audit', async (req, res) => {
    try {
      const { ETAAuditLog } = cds.db.model.entities('eta');
      const body = req.body;
      await INSERT.into(ETAAuditLog).entries({
        nominationId: body.nominationId,
        eventType: body.eventType,
        etaValue: body.etaValue,
        decisionMaker: body.decisionMaker || 'system',
        agentReasoning: body.agentReasoning || '',
        rejectionReason: body.rejectionReason || '',
        sourceAgents: body.sourceAgents || ''
      });
      res.status(201).json({ status: 'audit_logged' });
    } catch (e) {
      LOG.error('POST /api/audit failed:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/nominations/:id/eta ─────────────────────────
  // Called by the orchestrator agent after supervisor approval
  app.post('/api/nominations/:id/eta', async (req, res) => {
    try {
      const { NominationETA } = cds.db.model.entities('eta');
      const nominationId = req.params.id;
      const { approvedETA, decisionMaker, reasoning } = req.body;

      const record = await SELECT.one.from(NominationETA).where({ nominationId });
      if (!record) return res.status(404).json({ error: 'Not found' });

      await UPDATE(NominationETA, record.ID).with({ approvedETA, status: 'approved' });
      LOG.info(`[M4.achieved]: ETA approved via API — nominationId=${nominationId}`);
      res.json({ status: 'eta_approved', nominationId, approvedETA });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
