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

  if (existsSync(uiPath) && existsSync(join(uiPath, 'index.html'))) {
    // Serve static files with correct MIME types
    app.use(express.static(uiPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
        if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
        if (filePath.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml');
      }
    }));

    // SPA fallback — only for non-API, non-static requests
    app.use((req, res, next) => {
      const isStatic = req.path.includes('.') || 
                       req.path.startsWith('/api') || 
                       req.path.startsWith('/odata');
      if (isStatic) return next();
      res.sendFile(join(uiPath, 'index.html'));
    });
  }
});
