/**
 * Vercel Serverless Catch-All API Handler (api/[...all].js)
 * Catches all /api/* routes (e.g., /api/auth/login, /api/challenges, /api/status)
 */

const { app } = require('../backend/server');

module.exports = (req, res) => {
  // Guarantee /api prefix is present so Express routes always match
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
};
