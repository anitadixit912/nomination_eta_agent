import cds from '@sap/cds';
import express from 'express';
import { registerApiRoutes } from './api-router.js';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';

cds.on('served', async () => {
  // Seed sample data only when the table is empty (e.g. fresh SQLite DB)
  try {
    const { NominationETA } = cds.db.model.entities('eta');
    const count = await SELECT.one`count(*) as n`.from(NominationETA);
    if (parseInt(count?.n || 0) === 0) {
      await INSERT.into(NominationETA).entries([
        {
          nominationId: 'NOM-2026-0001', material: 'CRUDE OIL', transportSystem: 'TS01',
          origin: 'ROTTERDAM', destination: 'SINGAPORE', vesselMMSI: '123456789',
          vesselName: 'MV OCEAN STAR', proposedETA: '2026-09-25T08:00:00Z',
          status: 'proposed', confidence: 'High',
          reasoning: 'Based on 47 historical voyages, average transit time is 18.3 days. Vessel on schedule at 14.2 knots. Weather risk is low.',
          historicalData: '{"avg_lead_time_days":18.3,"min_days":16,"max_days":22,"sample_size":47,"recent_trend":"stable","confidence":"High"}',
          aisData: '{"remaining_distance_nm":4200,"sog_knots":14.2,"vessel_status":"underway","destination_mismatch":false,"confidence":"High"}',
          geoWeatherData: '{"overall_risk":"Low","weather_summary":{"weather_risk":"Low"},"geopolitical_summary":{"geo_risk":"Low"},"total_estimated_delay_days":0.5}'
        },
        {
          nominationId: 'NOM-2026-0002', material: 'LNG', transportSystem: 'TS02',
          origin: 'HOUSTON', destination: 'TOKYO', vesselMMSI: '987654321',
          vesselName: 'MV PACIFIC GLORY', proposedETA: '2026-10-05T10:00:00Z',
          status: 'proposed', confidence: 'Medium',
          reasoning: 'Based on 32 historical voyages. Average transit time is 28.5 days. Moderate weather risk in Pacific. Vessel at 13.5 knots.',
          historicalData: '{"avg_lead_time_days":28.5,"min_days":25,"max_days":34,"sample_size":32,"recent_trend":"slightly_increasing","confidence":"Medium"}',
          aisData: '{"remaining_distance_nm":8100,"sog_knots":13.5,"vessel_status":"underway","destination_mismatch":false,"confidence":"Medium"}',
          geoWeatherData: '{"overall_risk":"Medium","weather_summary":{"weather_risk":"Medium"},"geopolitical_summary":{"geo_risk":"Low"},"total_estimated_delay_days":1.5}'
        }
      ]);
      cds.log('server').info('Seeded 2 sample nominations into empty DB');
    }
  } catch (e) {
    cds.log('server').warn('Seed data skipped:', e.message);
  }
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
