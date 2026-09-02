import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell,
  Tag, Button, BusyIndicator,
  Title, Dialog, Bar, Input, Label,
  FlexBox, Card, CardHeader, Text,
  DatePicker
} from '@ui5/webcomponents-react';
import EtaProposalCard from './EtaProposalCard.jsx';
import AlternativesPanel from './AlternativesPanel.jsx';

const SERVICE = '/nomination-eta-service';

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

  useEffect(() => { load(); }, [load]);

  const openProposal = async (nom) => {
    // Fetch detail record with all evidence
    try {
      const res = await fetch(`${SERVICE}/NominationETADetail?$filter=nominationId eq '${nom.nominationId}'`);
      const data = await res.json();
      setSelected(data.value?.[0] || nom);
    } catch {
      setSelected(nom);
    }
    setShowProposal(true);
    setShowAlternatives(nom.status === 'rejected' && nom.alternatives);
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
    await fetch(`${SERVICE}/manualOverrideETA`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nominationId: selected.nominationId,
        manualETA: new Date(manualEta).toISOString(),
        decisionMaker: 'supervisor'
      })
    });
    setManualDialog(false);
    setManualEta('');
    setShowProposal(false);
    await load();
  };

  const handleRefresh = async (nom) => {
    await fetch(`/api/nominations/${nom.nominationId}/refresh`, { method: 'POST' });
    await load();
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
        <Button icon="refresh" onClick={load}>Refresh</Button>
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
                  {selected.status === 'rejected' && (
                    <Button
                      design="Attention"
                      onClick={() => setManualDialog(true)}
                      style={{ marginRight: '0.5rem' }}
                    >
                      Enter Manual ETA
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
            <DatePicker
              onChange={(e) => setManualEta(e.detail.value)}
              style={{ width: '100%' }}
            />
          </FlexBox>
        </Dialog>
      )}
    </div>
  );
}
