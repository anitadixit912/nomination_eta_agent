import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell,
  Tag, Button, BusyIndicator,
  Title, Dialog, Bar, Input, Label,
  FlexBox, Text
} from '@ui5/webcomponents-react';
import EtaProposalCard from './EtaProposalCard.jsx';
import AlternativesPanel from './AlternativesPanel.jsx';

const SERVICE = '/odata/v4/nomination-eta';

function confidenceBadge(confidence) {
  const map = { High: 'positive', Medium: 'critical', Low: 'negative' };
  return <Tag design={map[confidence] || 'Set3'}>{confidence || '—'}</Tag>;
}

function statusBadge(status) {
  const map = {
    proposed: 'Set3', approved: 'positive', rejected: 'negative',
    written_back: 'positive', reassessing: 'critical'
  };
  return <Tag design={map[status] || 'Set3'}>{status}</Tag>;
}

export default function ApprovalQueue() {
  const [nominations, setNominations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showProposal, setShowProposal] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [manualDialog, setManualDialog] = useState(false);
  const [manualEta, setManualEta] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SERVICE}/NominationETA?$orderby=createdAt desc`);
      const data = await res.json();
      setNominations(data.value || []);
    } catch (e) {
      console.error('Failed to load nominations', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // On page load: fetch from S/4HANA first, then load the list
    fetch('/api/fetch-nominations', { method: 'POST' })
      .then(() => load())
      .catch(() => load()); // always load even if S/4 fetch fails
  }, [load]);

  const openProposal = async (nom) => {
    try {
      const res = await fetch(`${SERVICE}/NominationETA?$filter=nominationId eq '${nom.nominationId}'`);
      const data = await res.json();
      const fresh = data.value?.[0] || nom;
      setSelected(fresh);
      setShowAlternatives(fresh.status === 'rejected' && fresh.alternatives);
    } catch {
      setSelected(nom);
      setShowAlternatives(nom.status === 'rejected' && nom.alternatives);
    }
    setShowProposal(true);
  };

  const handleApprove = async (nom) => {
    await fetch(`${SERVICE}/approveETA`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nominationId: nom.nominationId,
        approvedETA: nom.proposedETA,
        decisionMaker: 'supervisor'
      })
    });
    setShowProposal(false);
    await load();
  };

  const handleReject = async () => {
    await fetch(`${SERVICE}/rejectETA`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nominationId: selected.nominationId,
        rejectionReason: rejectReason,
        decisionMaker: 'supervisor'
      })
    });
    setRejectDialog(false);
    setRejectReason('');
    setShowProposal(false);
    await load();
  };

  const handleManualOverride = async () => {
    if (!manualEta) { alert('Please select a date'); return; }
    // CDS DateTime requires format: YYYY-MM-DDTHH:mm:ss (no Z, no milliseconds)
    const isoDate = `${manualEta}T12:00:00`;
    if (!manualEta.match(/^\d{4}-\d{2}-\d{2}$/)) { alert('Invalid date selected.'); return; }

    const res = await fetch(`${SERVICE}/manualOverrideETA`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nominationId: selected.nominationId,
        manualETA: isoDate,
        decisionMaker: 'supervisor'
      })
    });
    if (!res.ok) { alert('Failed to save manual ETA'); return; }
    setManualDialog(false);
    setManualEta('');
    await load();
    // Re-fetch fresh record and reopen dialog to show saved ETA
    const fresh = await fetch(`${SERVICE}/NominationETA?$filter=nominationId eq '${selected.nominationId}'`);
    const freshData = await fresh.json();
    if (freshData.value?.[0]) {
      setSelected(freshData.value[0]);
      setShowProposal(true);
    }
  };

  const handleRefresh = async (nom) => {
    await fetch(`/api/nominations/${nom.nominationId}/refresh`, { method: 'POST' });
    await load();
  };

  const handleAnalyze = async (nom) => {
    try {
      const res = await fetch(`/api/nominations/${nom.nominationId}/analyze`, { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        alert(`AI analysis failed: ${data.error}`);
      } else {
        await load();
        // Re-fetch fresh record and update dialog
        const fresh = await fetch(`/odata/v4/nomination-eta/NominationETA?$filter=nominationId eq '${nom.nominationId}'`);
        const freshData = await fresh.json();
        if (freshData.value?.[0]) setSelected(freshData.value[0]);
      }
    } catch (e) {
      alert('AI analysis failed');
    }
  };

  const handleFetchFromS4 = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fetch-nominations', { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        alert(`Failed to fetch from S/4HANA: ${data.error}`);
      } else {
        alert(`Fetched ${data.fetched} nominations, ${data.created} new added.`);
      }
    } catch (e) {
      alert('Failed to connect to S/4HANA');
    } finally {
      await load();
    }
  };

  const handleAlternativeSelect = async (alt) => {
    await fetch(`${SERVICE}/approveETA`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nominationId: selected.nominationId,
        approvedETA: alt.eta_utc,
        decisionMaker: 'supervisor'
      })
    });
    setShowProposal(false);
    await load();
  };

  return (
    <div>
      <FlexBox justifyContent="SpaceBetween" alignItems="Center" style={{ marginBottom: '1rem' }}>
        <Title level="H3">Nomination ETA Approval Queue</Title>
        <FlexBox style={{ gap: '0.5rem' }}>
          <Button icon="download-from-cloud" design="Emphasized" onClick={handleFetchFromS4}>Fetch from S/4HANA</Button>
          <Button icon="refresh" onClick={load}>Refresh</Button>
        </FlexBox>
      </FlexBox>

      {loading ? (
        <BusyIndicator active style={{ margin: '2rem auto', display: 'block' }} />
      ) : (
        <Table
          headerRow={
            <TableHeaderRow>
              <TableHeaderCell>Nomination ID</TableHeaderCell>
              <TableHeaderCell>Material</TableHeaderCell>
              <TableHeaderCell>Route</TableHeaderCell>
              <TableHeaderCell>Vessel</TableHeaderCell>
              <TableHeaderCell>Proposed ETA</TableHeaderCell>
              <TableHeaderCell>Confidence</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableHeaderRow>
          }
        >
          {nominations.map(nom => (
            <TableRow key={nom.ID}>
              <TableCell><Text>{nom.nominationId}</Text></TableCell>
              <TableCell><Text>{nom.material}</Text></TableCell>
              <TableCell><Text>{nom.origin} → {nom.destination}</Text></TableCell>
              <TableCell><Text>{nom.vesselName || nom.vesselMMSI || '—'}</Text></TableCell>
              <TableCell>
                <Text>{nom.proposedETA ? new Date(nom.proposedETA).toLocaleString() : '—'}</Text>
              </TableCell>
              <TableCell>{confidenceBadge(nom.confidence)}</TableCell>
              <TableCell>{statusBadge(nom.status)}</TableCell>
              <TableCell>
                <FlexBox>
                  <Button
                    design="Emphasized"
                    onClick={() => openProposal(nom)}
                    style={{ marginRight: '0.5rem' }}
                  >
                    Review
                  </Button>
                  <Button
                    icon="synchronize"
                    design="Transparent"
                    tooltip="Refresh ETA"
                    onClick={() => handleRefresh(nom)}
                  />
                </FlexBox>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      )}

      {/* Proposal Detail Dialog */}
      {showProposal && selected && (
        <Dialog
          open
          headerText={`ETA Proposal — ${selected.nominationId}`}
          style={{ width: '700px' }}
          footer={
            <Bar
              endContent={
                <FlexBox>
                  {selected.status === 'proposed' && (
                    <>
                      <Button
                        design="Positive"
                        onClick={() => handleApprove(selected)}
                        style={{ marginRight: '0.5rem' }}
                      >
                        Approve
                      </Button>
                      <Button
                        design="Negative"
                        onClick={() => setRejectDialog(true)}
                        style={{ marginRight: '0.5rem' }}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {(selected.status === 'rejected' || selected.status === 'written_back') && (
                    <Button
                      design="Attention"
                      onClick={() => setManualDialog(true)}
                      style={{ marginRight: '0.5rem' }}
                    >
                      {selected.status === 'written_back' ? 'Update Manual ETA' : 'Enter Manual ETA'}
                    </Button>
                  )}
                  {!selected.proposedETA && (
                    <Button
                      icon="ai"
                      design="Emphasized"
                      onClick={() => handleAnalyze(selected)}
                      style={{ marginRight: '0.5rem' }}
                    >
                      Analyze ETA with AI
                    </Button>
                  )}
                  <Button onClick={() => setShowProposal(false)}>Close</Button>
                </FlexBox>
              }
            />
          }
          onAfterClose={() => setShowProposal(false)}
        >
          <EtaProposalCard nomination={selected} />
          {showAlternatives && selected.alternatives && (
            <AlternativesPanel
              alternatives={JSON.parse(selected.alternatives)}
              onSelect={handleAlternativeSelect}
              onManual={() => { setShowProposal(false); setManualDialog(true); }}
            />
          )}
        </Dialog>
      )}

      {/* Reject Reason Dialog */}
      {rejectDialog && (
        <Dialog
          open
          headerText="Reject ETA Proposal"
          footer={
            <Bar
              endContent={
                <FlexBox>
                  <Button design="Negative" onClick={handleReject} style={{ marginRight: '0.5rem' }}>
                    Confirm Rejection
                  </Button>
                  <Button onClick={() => setRejectDialog(false)}>Cancel</Button>
                </FlexBox>
              }
            />
          }
          onAfterClose={() => setRejectDialog(false)}
        >
          <FlexBox direction="Column" style={{ padding: '1rem', gap: '0.5rem' }}>
            <Label>Rejection Reason (optional)</Label>
            <Input
              value={rejectReason}
              onInput={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. AIS data unavailable, cannot trust estimate"
              style={{ width: '100%' }}
            />
          </FlexBox>
        </Dialog>
      )}

      {/* Manual ETA Dialog */}
      {manualDialog && (
        <Dialog
          open
          headerText="Enter Manual ETA"
          footer={
            <Bar
              endContent={
                <FlexBox>
                  <Button design="Emphasized" onClick={handleManualOverride} style={{ marginRight: '0.5rem' }}>
                    Apply ETA
                  </Button>
                  <Button onClick={() => setManualDialog(false)}>Cancel</Button>
                </FlexBox>
              }
            />
          }
          onAfterClose={() => setManualDialog(false)}
        >
          <FlexBox direction="Column" style={{ padding: '1rem', gap: '0.5rem' }}>
            <Label>Manual ETA Date</Label>
            <input
              type="date"
              value={manualEta}
              onChange={(e) => setManualEta(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </FlexBox>
        </Dialog>
      )}
    </div>
  );
}
