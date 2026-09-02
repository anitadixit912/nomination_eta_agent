import cds from '@sap/cds';

const LOG = cds.log('nomination-eta-service');

export default class NominationETAService extends cds.ApplicationService {

  async init() {

    // ── approveETA ─────────────────────────────────────────
    this.on('approveETA', async (req) => {
      const { nominationId, approvedETA, decisionMaker } = req.data;
      const { NominationETA, ETAAuditLog } = this.entities;

      // 1. Find the current proposal
      const proposal = await SELECT.one.from(NominationETA)
        .where({ nominationId });
      if (!proposal) return req.reject(404, `Nomination ${nominationId} not found`);
      if (proposal.status === 'approved') return req.reject(409, 'ETA already approved');

      // 2. Update status → approved
      await UPDATE(NominationETA, proposal.ID).with({
        approvedETA,
        status: 'approved'
      });

      // 3. Write audit log
      await INSERT.into(ETAAuditLog).entries({
        nominationId,
        eventType: 'approved',
        etaValue: approvedETA,
        decisionMaker,
        agentReasoning: proposal.reasoning,
        sourceAgents: 'historical-nomination-agent, ais-vessel-tracking-agent, geo-weather-agent'
      });

      // 4. Write-back to OGS/650 via Cloud Connector
      try {
        await _writeETAToOGS(nominationId, approvedETA, decisionMaker, proposal.reasoning);
        await UPDATE(NominationETA, proposal.ID).with({ status: 'written_back' });
        await INSERT.into(ETAAuditLog).entries({
          nominationId,
          eventType: 'written_back',
          etaValue: approvedETA,
          decisionMaker,
          agentReasoning: `ETA written back to OGS/650`,
          sourceAgents: 'nomination-eta-cap'
        });
        LOG.info(`[M5.achieved]: ETA written to OGS/650 — nominationId=${nominationId}`);
      } catch (e) {
        LOG.error(`[M5.missed]: ETA write to OGS/650 failed — nominationId=${nominationId}, reason=${e.message}`);
        // Don't fail the action — the approval is recorded, OGS write can be retried
      }

      return `ETA approved for nomination ${nominationId}`;
    });

    // ── rejectETA ──────────────────────────────────────────
    this.on('rejectETA', async (req) => {
      const { nominationId, rejectionReason, decisionMaker } = req.data;
      const { NominationETA, ETAAuditLog } = this.entities;

      const proposal = await SELECT.one.from(NominationETA).where({ nominationId });
      if (!proposal) return req.reject(404, `Nomination ${nominationId} not found`);

      await UPDATE(NominationETA, proposal.ID).with({
        status: 'rejected',
        rejectionReason: rejectionReason || ''
      });

      await INSERT.into(ETAAuditLog).entries({
        nominationId,
        eventType: 'rejected',
        etaValue: proposal.proposedETA,
        decisionMaker,
        agentReasoning: proposal.reasoning,
        rejectionReason: rejectionReason || '',
        sourceAgents: 'nomination-eta-cap'
      });

      LOG.info(`[M4.achieved]: supervisor rejected ETA — nominationId=${nominationId}`);
      return `ETA rejected for nomination ${nominationId}`;
    });

    // ── manualOverrideETA ──────────────────────────────────
    this.on('manualOverrideETA', async (req) => {
      const { nominationId, manualETA, decisionMaker } = req.data;
      const { NominationETA, ETAAuditLog } = this.entities;

      const proposal = await SELECT.one.from(NominationETA).where({ nominationId });
      if (!proposal) return req.reject(404, `Nomination ${nominationId} not found`);

      await UPDATE(NominationETA, proposal.ID).with({
        approvedETA: manualETA,
        status: 'written_back'
      });

      await INSERT.into(ETAAuditLog).entries({
        nominationId,
        eventType: 'manual_override',
        etaValue: manualETA,
        decisionMaker,
        agentReasoning: 'Supervisor manual ETA override',
        sourceAgents: 'nomination-eta-cap'
      });

      // Write to OGS/650
      try {
        await _writeETAToOGS(nominationId, manualETA, decisionMaker, 'Manual override by supervisor');
        LOG.info(`[M5.achieved]: Manual ETA written to OGS/650 — nominationId=${nominationId}`);
      } catch (e) {
        LOG.error(`[M5.missed]: Manual ETA write failed — nominationId=${nominationId}, reason=${e.message}`);
      }

      return `Manual ETA applied for nomination ${nominationId}`;
    });

    await super.init();
  }
}

// ── OGS/650 write-back via SAP Cloud Connector ─────────────
async function _writeETAToOGS(nominationId, eta, user, reason) {
  const CONNECTIVITY_PROXY = process.env.CONNECTIVITY_PROXY
    || 'connectivityproxy.internal.cf.us10.hana.ondemand.com:20003';
  const CLOUD_CONNECTOR_LOCATION = process.env.CLOUD_CONNECTOR_LOCATION_ID || 'APAC_DEV10';
  const OGS_BASE_URL = process.env.OGS_BASE_URL || 'http://10.236.250.15:8001';
  const OGS_USER = process.env.OGS_USER || 'i336812';
  const OGS_PASSWORD = process.env.OGS_PASSWORD || '';

  const credentials = Buffer.from(`${OGS_USER}:${OGS_PASSWORD}`).toString('base64');

  // SOAP envelope for Change TSW Nomination
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:nom="http://sap.com/xi/OIL/TSW">
  <soapenv:Header/>
  <soapenv:Body>
    <nom:ChangeNomination>
      <NominationID>${nominationId}</NominationID>
      <ETA>${new Date(eta).toISOString()}</ETA>
      <ChangedBy>${user}</ChangedBy>
      <ChangeReason>${reason?.substring(0, 200) || 'AI-proposed ETA approved'}</ChangeReason>
    </nom:ChangeNomination>
  </soapenv:Body>
</soapenv:Envelope>`;

  const url = `${OGS_BASE_URL}/sap/bc/srt/wsdl/soap1.1/service_definition/TSW_NOMINATION`;

  if (!OGS_PASSWORD) {
    throw new Error(
      'OGS_PASSWORD environment variable is not set. ' +
      'Cannot write ETA to OGS/650. ' +
      'Set OGS_PASSWORD in the deployment environment before approving nominations.'
    );
  }

  const { default: https } = await import('https');
  const { default: http } = await import('http');
  const client = url.startsWith('https') ? https : http;

  await new Promise((resolve, reject) => {
    const req = client.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        'SOAPAction': 'ChangeNomination',
        'Authorization': `Basic ${credentials}`,
        'SAP-Connectivity-SCC-Location_ID': CLOUD_CONNECTOR_LOCATION
      }
    }, (res) => {
      res.resume();
      if (res.statusCode >= 200 && res.statusCode < 300) resolve();
      else reject(new Error(`OGS returned ${res.statusCode}`));
    });
    req.on('error', reject);
    req.write(soapBody);
    req.end();
  });
}
