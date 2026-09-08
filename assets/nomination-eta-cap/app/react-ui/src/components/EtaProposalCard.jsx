import React from 'react';
import {
  Card, CardHeader, FlexBox, FlexBoxDirection,
  Text, Title, Tag, Panel, ObjectStatus
} from '@ui5/webcomponents-react';

function confidenceState(c) {
  return c === 'High' ? 'Positive' : c === 'Medium' ? 'Critical' : 'Negative';
}

export default function EtaProposalCard({ nomination }) {
  const historical = nomination.historicalData
    ? JSON.parse(nomination.historicalData) : null;
  const ais = nomination.aisData
    ? JSON.parse(nomination.aisData) : null;
  const geoWeather = nomination.geoWeatherData
    ? JSON.parse(nomination.geoWeatherData) : null;

  return (
    <FlexBox direction={FlexBoxDirection.Column} style={{ padding: '1rem', gap: '1rem' }}>

      {/* Main proposal */}
      <Card header={<CardHeader titleText="Proposed ETA" />}>
        <FlexBox style={{ padding: '1rem', gap: '2rem' }}>
          <FlexBox direction="Column">
            <Text style={{ color: '#6e6e6e', fontSize: '0.75rem' }}>PROPOSED ETA</Text>
            <Title level="H4">
              {nomination.proposedETA
                ? new Date(nomination.proposedETA).toLocaleString()
                : '—'}
            </Title>
          </FlexBox>
          {nomination.approvedETA && (
            <FlexBox direction="Column">
              <Text style={{ color: '#6e6e6e', fontSize: '0.75rem' }}>
                {nomination.status === 'written_back' ? 'MANUAL ETA' : 'APPROVED ETA'}
              </Text>
              <Title level="H4" style={{ color: '#0070f2' }}>
                {new Date(nomination.approvedETA).toLocaleString()}
              </Title>
            </FlexBox>
          )}
          <FlexBox direction="Column">
            <Text style={{ color: '#6e6e6e', fontSize: '0.75rem' }}>CONFIDENCE</Text>
            <ObjectStatus state={confidenceState(nomination.confidence)}>
              {nomination.confidence || '—'}
            </ObjectStatus>
          </FlexBox>
          <FlexBox direction="Column">
            <Text style={{ color: '#6e6e6e', fontSize: '0.75rem' }}>STATUS</Text>
            <Tag>{nomination.status}</Tag>
          </FlexBox>
        </FlexBox>
        <FlexBox direction="Column" style={{ padding: '0 1rem 1rem' }}>
          <Text style={{ color: '#6e6e6e', fontSize: '0.75rem', marginBottom: '0.25rem' }}>AGENT REASONING</Text>
          <Text>{nomination.reasoning || 'No reasoning available.'}</Text>
        </FlexBox>
      </Card>

      {/* Supporting Evidence */}
      <Panel headerText="Supporting Evidence" collapsed>
        <FlexBox style={{ padding: '1rem', gap: '1rem', flexWrap: 'wrap' }}>

          {/* Historical */}
          <Card header={<CardHeader titleText="Historical Voyages" />} style={{ flex: 1, minWidth: '200px' }}>
            <FlexBox direction="Column" style={{ padding: '1rem', gap: '0.5rem' }}>
              {historical ? (
                <>
                  <Text><b>Avg Lead Time:</b> {historical.avg_lead_time_days} days</Text>
                  <Text><b>Range:</b> {historical.min_days}–{historical.max_days} days</Text>
                  <Text><b>Sample:</b> {historical.sample_size} voyages</Text>
                  <Text><b>Trend:</b> {historical.recent_trend}</Text>
                  <ObjectStatus state={confidenceState(historical.confidence)}>
                    {historical.confidence}
                  </ObjectStatus>
                </>
              ) : <Text>No historical data</Text>}
            </FlexBox>
          </Card>

          {/* AIS */}
          <Card header={<CardHeader titleText="Live Vessel Position (AIS)" />} style={{ flex: 1, minWidth: '200px' }}>
            <FlexBox direction="Column" style={{ padding: '1rem', gap: '0.5rem' }}>
              {ais ? (
                <>
                  <Text><b>Distance:</b> {ais.remaining_distance_nm} NM</Text>
                  <Text><b>Speed:</b> {ais.sog_knots} knots</Text>
                  <Text><b>Status:</b> {ais.vessel_status}</Text>
                  {ais.destination_mismatch && (
                    <Tag design="critical">Destination mismatch</Tag>
                  )}
                  <ObjectStatus state={confidenceState(ais.confidence)}>
                    {ais.confidence}
                  </ObjectStatus>
                </>
              ) : <Text>AIS data unavailable</Text>}
            </FlexBox>
          </Card>

          {/* Geo / Weather */}
          <Card header={<CardHeader titleText="Route Risk Assessment" />} style={{ flex: 1, minWidth: '200px' }}>
            <FlexBox direction="Column" style={{ padding: '1rem', gap: '0.5rem' }}>
              {geoWeather ? (
                <>
                  <Text><b>Overall Risk:</b> {geoWeather.overall_risk}</Text>
                  <Text><b>Weather:</b> {geoWeather.weather_summary?.weather_risk}</Text>
                  <Text><b>Geopolitical:</b> {geoWeather.geopolitical_summary?.geo_risk}</Text>
                  <Text><b>Est. Delay:</b> {geoWeather.total_estimated_delay_days} days</Text>
                </>
              ) : <Text>Risk data unavailable</Text>}
            </FlexBox>
          </Card>
        </FlexBox>
      </Panel>

      {/* Nomination Details */}
      <Panel headerText="Nomination Details" collapsed>
        <FlexBox style={{ padding: '1rem', gap: '2rem', flexWrap: 'wrap' }}>
          <FlexBox direction="Column">
            <Text style={{ color: '#6e6e6e', fontSize: '0.75rem' }}>MATERIAL</Text>
            <Text>{nomination.material}</Text>
          </FlexBox>
          <FlexBox direction="Column">
            <Text style={{ color: '#6e6e6e', fontSize: '0.75rem' }}>TRANSPORT SYSTEM</Text>
            <Text>{nomination.transportSystem}</Text>
          </FlexBox>
          <FlexBox direction="Column">
            <Text style={{ color: '#6e6e6e', fontSize: '0.75rem' }}>ORIGIN</Text>
            <Text>{nomination.origin}</Text>
          </FlexBox>
          <FlexBox direction="Column">
            <Text style={{ color: '#6e6e6e', fontSize: '0.75rem' }}>DESTINATION</Text>
            <Text>{nomination.destination}</Text>
          </FlexBox>
          <FlexBox direction="Column">
            <Text style={{ color: '#6e6e6e', fontSize: '0.75rem' }}>VESSEL</Text>
            <Text>{nomination.vesselName} ({nomination.vesselMMSI})</Text>
          </FlexBox>
        </FlexBox>
      </Panel>
    </FlexBox>
  );
}
