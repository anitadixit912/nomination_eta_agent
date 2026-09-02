import React, { useState } from 'react';
import {
  Panel, FlexBox, Card, CardHeader,
  Text, Title, Tag, ObjectStatus, Button, RadioButton
} from '@ui5/webcomponents-react';

function confidenceState(c) {
  return c === 'High' ? 'Positive' : c === 'Medium' ? 'Critical' : 'Negative';
}

const LABEL_DESIGN = {
  Optimistic: 'positive',
  Baseline: 'Set3',
  Conservative: 'critical'
};

export default function AlternativesPanel({ alternatives, onSelect, onManual }) {
  const [selectedLabel, setSelectedLabel] = useState(null);

  if (!alternatives || alternatives.length === 0) return null;

  const selectedAlt = alternatives.find(a => a.label === selectedLabel);

  return (
    <Panel
      headerText="Alternative ETA Proposals — Deeper Analysis"
      style={{ marginTop: '1rem' }}
    >
      <FlexBox direction="Column" style={{ padding: '1rem', gap: '0.75rem' }}>
        <Text style={{ color: '#6e6e6e', marginBottom: '0.5rem' }}>
          The initial proposal was rejected. The agent performed a deeper historical analysis
          and offers the following alternatives. Select one or enter a manual ETA.
        </Text>

        {alternatives.map((alt, idx) => (
          <Card
            key={idx}
            header={
              <CardHeader
                titleText={alt.label}
                subtitleText={`Confidence: ${alt.confidence}`}
              />
            }
            style={{
              cursor: 'pointer',
              border: selectedLabel === alt.label ? '2px solid #0070f3' : '1px solid #d9d9d9'
            }}
            onClick={() => setSelectedLabel(alt.label)}
          >
            <FlexBox style={{ padding: '1rem', gap: '0.5rem', alignItems: 'flex-start' }}>
              <RadioButton
                name="eta-alt"
                checked={selectedLabel === alt.label}
                onChange={() => setSelectedLabel(alt.label)}
                style={{ marginTop: '0.2rem', marginRight: '0.5rem', flexShrink: 0 }}
              />
              <FlexBox direction="Column" style={{ gap: '0.4rem', flex: 1 }}>
                <FlexBox style={{ gap: '2rem' }}>
                  <FlexBox direction="Column">
                    <Text style={{ color: '#6e6e6e', fontSize: '0.75rem' }}>ETA</Text>
                    <Title level="H5">
                      {alt.eta_utc ? new Date(alt.eta_utc).toLocaleString() : '—'}
                    </Title>
                  </FlexBox>
                  <FlexBox direction="Column">
                    <Text style={{ color: '#6e6e6e', fontSize: '0.75rem' }}>CONFIDENCE</Text>
                    <ObjectStatus state={confidenceState(alt.confidence)}>
                      {alt.confidence}
                    </ObjectStatus>
                  </FlexBox>
                  <FlexBox direction="Column">
                    <Text style={{ color: '#6e6e6e', fontSize: '0.75rem' }}>TYPE</Text>
                    <Tag design={LABEL_DESIGN[alt.label] || 'Set3'}>{alt.label}</Tag>
                  </FlexBox>
                </FlexBox>
                <Text style={{ marginTop: '0.25rem' }}>{alt.reasoning}</Text>
              </FlexBox>
            </FlexBox>
          </Card>
        ))}

        <FlexBox style={{ gap: '0.75rem', marginTop: '0.5rem' }}>
          <Button
            design="Emphasized"
            disabled={!selectedAlt}
            onClick={() => selectedAlt && onSelect(selectedAlt)}
          >
            Approve Selected ETA
          </Button>
          <Button design="Transparent" onClick={onManual}>
            Enter Manual ETA Instead
          </Button>
        </FlexBox>
      </FlexBox>
    </Panel>
  );
}
