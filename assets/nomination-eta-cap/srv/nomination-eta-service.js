import cds from '@sap/cds';

const LOG = cds.log('nomination-eta-service');

export default class NominationETAService extends cds.ApplicationService {

  async init() {

    // ── approveETA ─────────────────────────────────────────
    this.on('approveETA', async (req) => {
      const { nominationId, approvedETA, decisionMaker } = req.data;
      const { NominationETA, ETAAuditLog } = this.entities;

      const proposal = await SELECT.one.from(NominationETA).where({ nominationId });
      if (!proposal) return req.reject(404, `Nomination ${nominationId} not found`);
      if (proposal.status === 'approved') return req.reject(409, 'ETA already approved');

      await UPDATE(NominationETA, proposal.ID).with({ approvedETA, status: 'approved' });

      await INSERT.into(ETAAuditLog).entries({
        nominationId,
        eventType: 'approved',
        etaValue: approvedETA,
        decisionMaker,
        agentReasoning: proposal.reasoning,
        sourceAgents: 'historical-nomination-agent, ais-vessel-tracking-agent, geo-weather-agent'
      });

      // Write-back to OGS/650 via OGS_S4 destination
      try {
        await _writeETAToOGS(nominationId, approvedETA, decisionMaker, proposal.reasoning);
        await UPDATE(NominationETA, proposal.ID).with({ status: 'written_back' });
        await INSERT.into(ETAAuditLog).entries({
          nominationId,
          eventType: 'written_back',
          etaValue: approvedETA,
          decisionMaker,
          agentReasoning: 'ETA written back to OGS/650 via OGS_S4 destination',
          sourceAgents: 'nomination-eta-cap'
        });
        LOG.info(`[M5.achieved]: ETA written to OGS/650 — nominationId=${nominationId}`);
      } catch (e) {
        LOG.error(`[M5.missed]: ETA write to OGS/650 failed — nominationId=${nominationId}, reason=${e.message}`);
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

// ── OGS/650 write-back via SAP Destination OGS_S4 ──────────
async function _writeETAToOGS(nominationId, eta, user, reason) {
  const dest = await cds.connect.to('OGS_S4');

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

  const response = await dest.send({
    method: 'POST',
    path: '/sap/bc/srt/wsdl/soap1.1/service_definition/TSW_NOMINATION',
    headers: {
      'Content-Type': 'text/xml; charset=UTF-8',
      'SOAPAction': 'ChangeNomination'
    },
    data: soapBody
  });

  if (response?.status >= 300) {
    throw new Error(`OGS_S4 destination returned HTTP ${response.status}`);
  }
}
