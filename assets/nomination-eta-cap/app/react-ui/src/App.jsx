import React, { useState } from 'react';
import { ThemeProvider } from '@ui5/webcomponents-react';
import ApprovalQueue from './components/ApprovalQueue.jsx';
import AuditLogView from './components/AuditLogView.jsx';
import {
  ShellBar,
  ShellBarItem,
  Tab,
  TabContainer,
} from '@ui5/webcomponents-react';
import '@ui5/webcomponents-icons/dist/approvals.js';
import '@ui5/webcomponents-icons/dist/activity-items.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('queue');

  return (
    <ThemeProvider>
      <ShellBar
        primaryTitle="Nomination ETA Agent"
        secondaryTitle="Approval Queue"
        style={{ marginBottom: '1rem' }}
      />
      <div style={{ padding: '0 1rem' }}>
        <TabContainer
          onTabSelect={(e) => setActiveTab(e.detail.tab.dataset.key)}
          style={{ marginBottom: '1rem' }}
        >
          <Tab text="Approval Queue" icon="approvals" data-key="queue" selected={activeTab === 'queue'} />
          <Tab text="Audit Log" icon="activity-items" data-key="audit" selected={activeTab === 'audit'} />
        </TabContainer>

        {activeTab === 'queue' && <ApprovalQueue />}
        {activeTab === 'audit' && <AuditLogView />}
      </div>
    </ThemeProvider>
  );
}
