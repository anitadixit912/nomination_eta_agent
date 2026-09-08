import cds from '@sap/cds';
import express from 'express';
import { registerApiRoutes, _fetchFromS4 } from './api-router.js';
import { join } from 'path';
import { existsSync } from 'fs';

// ── Fetch open nominations from S/4HANA OGS/650 ──────────────
async function fetchNominationsFromS4() {
  const LOG = cds.log('s4-poller');
  try {
    const nominations = await _fetchFromS4();
    LOG.info(`Fetched ${nominations.length} open nominations from S/4HANA`);
    const { NominationETA } = cds.db.model.entities('eta');
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
        LOG.info(`Created nomination: ${nominationId}`);
      }
    }
    return nominations.length;
  } catch (e) {
    LOG.warn('S/4HANA fetch failed:', e.message);
    return 0;
  }
}

cds.on('served', async () => {
  // Start polling S/4HANA every 30 minutes
  const POLL_INTERVAL_MS = 30 * 60 * 1000;
  setInterval(async () => {
    cds.log('s4-poller').info('Polling S/4HANA for open nominations...');
    await fetchNominationsFromS4();
  }, POLL_INTERVAL_MS);

  // Also poll once on startup (after 10 seconds)
  setTimeout(async () => {
    cds.log('s4-poller').info('Initial S/4HANA poll on startup...');
    await fetchNominationsFromS4();
  }, 10000);
});

cds.on('bootstrap', (app) => {
  app.use(express.json());
  registerApiRoutes(app);

  const uiPath = join(process.cwd(), 'app');

  if (existsSync(join(uiPath, 'index.html'))) {
    console.log('[UI] Serving React UI from:', uiPath);
    app.use(express.static(uiPath));
    app.use((req, res, next) => {
      if (req.path.startsWith('/odata') ||
          req.path.startsWith('/api') ||
          req.path.startsWith('/rest') ||
          req.path.match(/\.\w+$/)) {
        return next();
      }
      res.sendFile(join(uiPath, 'index.html'));
    });
  } else {
    console.warn('[UI] index.html NOT found at:', uiPath);
  }
});
