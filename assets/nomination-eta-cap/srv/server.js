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
  
  // Try gen/srv/app first (production), then app/react-ui/dist (local)
  const prodPath = join(__dirname, '..', 'app');
  const devPath = join(__dirname, '..', '..', 'app', 'react-ui', 'dist');
  const uiPath = existsSync(prodPath) && existsSync(join(prodPath, 'index.html')) 
    ? prodPath 
    : devPath;

  if (existsSync(uiPath) && existsSync(join(uiPath, 'index.html'))) {
    app.use(express.static(uiPath));
    app.get('/', (req, res) => {
      res.sendFile(join(uiPath, 'index.html'));
    });
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/odata') || req.path.startsWith('/odata/v4')) return next();
      res.sendFile(join(uiPath, 'index.html'));
    });
  }
});
