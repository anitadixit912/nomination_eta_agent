import cds from '@sap/cds';
import express from 'express';
import { registerApiRoutes } from './api-router.js';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';

cds.on('bootstrap', (app) => {
  app.use(express.json());
  registerApiRoutes(app);

  // CF deploys gen/srv contents to /home/vcap/app
  // So gen/srv/app becomes /home/vcap/app/app
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
      if (req.path.startsWith('/odata') ||
          req.path.startsWith('/api') ||
          req.path.match(/\.\w+$/)) {
        return next();
      }
      res.sendFile(join(uiPath, 'index.html'));
    });
  } else {
    console.warn('[UI] index.html NOT found at:', uiPath);
  }
});
