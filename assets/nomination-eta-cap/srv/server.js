import cds from '@sap/cds';
import express from 'express';
import { registerApiRoutes } from './api-router.js';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

cds.on('bootstrap', (app) => {
  app.use(express.json());
  registerApiRoutes(app);

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const uiPath = join(__dirname, '..', 'app');

  if (existsSync(uiPath)) {
    app.use(express.static(uiPath));
    app.get('/', (req, res) => {
      res.sendFile(join(uiPath, 'index.html'));
    });
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/odata')) return next();
      res.sendFile(join(uiPath, 'index.html'));
    });
  }
});