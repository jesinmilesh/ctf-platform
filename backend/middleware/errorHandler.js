/**
 * XPLOITX // CYBER BATTLEFIELD
 * Central Error Handler (backend/middleware/errorHandler.js)
 */

function errorHandler(err, req, res, next) {
  console.error('[C2 SYSTEM ERROR]:', err);

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: err.name || 'INTERNAL_ERROR',
    message: err.message || 'Battlefield server encountered an unexpected condition.',
    timestamp: new Date().toISOString()
  });
}

module.exports = { errorHandler };
