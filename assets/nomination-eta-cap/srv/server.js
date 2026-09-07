import cds from '@sap/cds';
import express from 'express';
import { registerApiRoutes } from './api-router.js';
import { join } from 'path';
import { existsSync } from 'fs';

cds.on('bootstrap', (app) => {
  app.use(express.json());
  registerApiRoutes(app);

  // In CF, process.cwd() = /home/vcap/app/
  // UI files are copied to gen/srv/app/ which deploys to /home/vcap/app/app/
  const uiPath = join(process.cwd(), 'app');

  console.log('[UI] Looking for UI at:', uiPath);
  console.log('[UI] index.html exists:', existsSync(join(uiPath, 'index.html')));

  if (existsSync(join(uiPath, 'index.html'))) {
    console.log('[UI] Serving static files from:', uiPath);

    // Serve static assets first (JS, CSS, images)
    app.use(express.static(uiPath));

    // SPA fallback for all non-API routes
    app.use((req, res, next) => {
      if (req.path.startsWith('/odata') ||
          req.path.startsWith('/api') ||
          req.path.includes('.')) {
        return next();
      }
      res.sendFile(join(uiPath, 'index.html'));
    });
  } else {
    console.warn('[UI] No UI found at', uiPath);
  }
});
