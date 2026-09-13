/**
 * Vercel Serverless Root API Handler (api/index.js)
 * Catches /api root requests
 */

const { app } = require('../backend/server');

module.exports = (req, res) => {
  req.url = req.url || '/';
  // Guarantee /api prefix is present so Express routes always match
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
};
