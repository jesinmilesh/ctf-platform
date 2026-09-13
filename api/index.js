/**
 * Vercel Serverless API Entrypoint (api/index.js)
 * Exports the Express app as a Vercel Serverless Function handler
 */

const { app } = require('../backend/server');

module.exports = app;
