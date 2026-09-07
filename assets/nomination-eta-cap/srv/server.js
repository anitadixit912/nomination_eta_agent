import cds from '@sap/cds';
import express from 'express';
import { registerApiRoutes } from './api-router.js';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';

cds.on('bootstrap', (app) => {
  app.use(express.json());
  registerApiRoutes(app);

  const uiPath = join(process.cwd(), 'app');

  console.log('[UI] cwd:', process.cwd());
  console.log('[UI] uiPath:', uiPath);
  console.log('[UI] exists:', existsSync(uiPath));

  if (existsSync(uiPath)) {
    console.log('[UI] contents:', readdirSync(uiPath));
  }

  if (existsSync(join(uiPath, 'index.html'))) {
    console.log('[UI] Serving React UI from:', uiPath);
    app.use(express.static(uiPath));
    app.use((req, res, next) => {
      // Let CDS handle OData, API and any file with an extension
      if (req.path.startsWith('/odata') ||
          req.path.startsWith('/api') ||
          req.path.startsWith('/nomination-eta-service') ||
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
