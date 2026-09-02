import cds from '@sap/cds';
import express from 'express';
import { registerApiRoutes } from './api-router.js';

cds.on('bootstrap', (app) => {
  app.use(express.json());
  registerApiRoutes(app);
});
