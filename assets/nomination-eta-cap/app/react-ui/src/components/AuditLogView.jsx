import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell,
  Tag, BusyIndicator, Title, Text,
  FlexBox, Input, Button, Label
} from '@ui5/webcomponents-react';

const SERVICE = '/odata/v4/nomination-eta-service';

function eventBadge(eventType) {
  const map = {
    proposed: '6',
    approved: 'Success',
    rejected: 'Error',
    written_back: 'Success',
    manual_override: 'Warning',
    deviation_flagged: '2'
  };
  return <Tag design={map[eventType] || 'Set3'}>{eventType?.replace('_', ' ')}</Tag>;
}

export default function AuditLogView() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterNomId, setFilterNomId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${SERVICE}/ETAAuditLog?$orderby=createdAt desc&$top=200`;
      if (filterNomId.trim()) {
        url += `&$filter=nominationId eq '${filterNomId.trim()}'`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setEntries(data.value || []);
    } catch (e) {
      console.error('Failed to load audit log', e);
    } finally {
      setLoading(false);
    }
  }, [filterNomId]);

  useEffect(() => { load(); }, []);

  return (
    <div>
      <FlexBox justifyContent="SpaceBetween" alignItems="Center" style={{ marginBottom: '1rem' }}>
        <Title level="H3">ETA Audit Log</Title>
        <FlexBox style={{ gap: '0.5rem', alignItems: 'center' }}>
          <Label>Filter by Nomination ID:</Label>
          <Input
            value={filterNomId}
            onInput={(e) => setFilterNomId(e.target.value)}
            placeholder="e.g. NOM-2026-0001"
          />
          <Button icon="search" onClick={load}>Search</Button>
          <Button
            icon="clear-filter"
            design="Transparent"
            onClick={() => { setFilterNomId(''); setTimeout(load, 0); }}
          >
            Clear
          </Button>
        </FlexBox>
      </FlexBox>

      {loading ? (
        <BusyIndicator active style={{ margin: '2rem auto', display: 'block' }} />
      ) : entries.length === 0 ? (
        <Text style={{ color: '#6e6e6e', padding: '1rem' }}>No audit entries found.</Text>
      ) : (
        <Table
          headerRow={
            <TableHeaderRow>
              <TableHeaderCell>Nomination ID</TableHeaderCell>
              <TableHeaderCell>Event</TableHeaderCell>
              <TableHeaderCell>ETA Value</TableHeaderCell>
              <TableHeaderCell>Decision Maker</TableHeaderCell>
              <TableHeaderCell>Source Agents</TableHeaderCell>
              <TableHeaderCell>Rejection Reason</TableHeaderCell>
              <TableHeaderCell>Timestamp</TableHeaderCell>
              <TableHeaderCell>Reasoning</TableHeaderCell>
            </TableHeaderRow>
          }
        >
          {entries.map(entry => (
            <TableRow key={entry.ID}>
              <TableCell><Text>{entry.nominationId}</Text></TableCell>
              <TableCell>{eventBadge(entry.eventType)}</TableCell>
              <TableCell>
                <Text>
                  {entry.etaValue ? new Date(entry.etaValue).toLocaleString() : '—'}
                </Text>
              </TableCell>
              <TableCell><Text>{entry.decisionMaker || '—'}</Text></TableCell>
              <TableCell>
                <Text style={{ fontSize: '0.8rem', color: '#6e6e6e' }}>
                  {entry.sourceAgents || '—'}
                </Text>
              </TableCell>
              <TableCell>
                <Text style={{ color: entry.rejectionReason ? '#bb0000' : '#6e6e6e' }}>
                  {entry.rejectionReason || '—'}
                </Text>
              </TableCell>
              <TableCell>
                <Text style={{ fontSize: '0.8rem' }}>
                  {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}
                </Text>
              </TableCell>
              <TableCell>
                <Text
                  style={{
                    fontSize: '0.8rem',
                    maxWidth: '300px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={entry.agentReasoning}
                >
                  {entry.agentReasoning
                    ? entry.agentReasoning.substring(0, 120) + (entry.agentReasoning.length > 120 ? '…' : '')
                    : '—'}
                </Text>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      )}
    </div>
  );
}
