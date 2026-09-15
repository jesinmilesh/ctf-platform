/**
 * XPLOITX // CYBER BATTLEFIELD
 * Central Error Handler (backend/middleware/errorHandler.js)
 * Implements Section 43, 88: Sanitized Production Errors & Request ID Correlation
 */

function sanitizeDatabaseError(err) {
  if (!err) return null;
  const errMsg = String(err.message || '');
  const errName = String(err.name || '');

  // 1. Duplicate Key Error (E11000)
  if (err.code === 11000 || errMsg.includes('E11000') || errMsg.includes('duplicate key')) {
    return {
      status: 409,
      code: 'RESOURCE_ALREADY_EXISTS',
      message: 'A resource with this identifier or unique attribute already exists.'
    };
  }

  // 2. Database Connection / Timeout Error
  if (
    errMsg.includes('Server selection timed out') ||
    errMsg.includes('MongoTimeoutError') ||
    errMsg.includes('topology was destroyed') ||
    errName === 'MongoTimeoutError' ||
    errName === 'MongoServerSelectionError'
  ) {
    return {
      status: 503,
      code: 'DATABASE_TIMEOUT',
      message: 'The database operation timed out. Please retry shortly.'
    };
  }

  // 3. Generic MongoDB Error
  if (errName.startsWith('Mongo') || errName.startsWith('Mongoose')) {
    return {
      status: 500,
      code: 'DATABASE_ERROR',
      message: 'An internal database operation failed. The incident has been recorded.'
    };
  }

  return null;
}

function errorHandler(err, req, res, next) {
  // Check for MongoDB-specific errors and sanitize completely
  const dbError = sanitizeDatabaseError(err);
  const status = dbError ? dbError.status : (err.status || err.statusCode || 500);
  const isServerErr = status >= 500;
  
  const code = dbError ? dbError.code : (err.code || (
    status === 401 ? 'AUTHENTICATION_REQUIRED' :
    status === 403 ? 'FORBIDDEN' :
    status === 404 ? 'NOT_FOUND' :
    status === 400 ? 'VALIDATION_ERROR' :
    status === 409 ? 'RESOURCE_CONFLICT' :
    'REQUEST_FAILED'
  ));

  // Log detailed error and stack trace server-side only (never expose to client)
  console.error(`[SYSTEM_ERROR] [ReqID: ${req.id || 'N/A'}] [${req.method} ${req.originalUrl || req.url}] Status ${status}:`, err.stack || err);

  const safeMessage = dbError
    ? dbError.message
    : ((isServerErr && process.env.NODE_ENV === 'production')
        ? 'The request could not be completed.'
        : (err.message || 'The request could not be completed.'));

  res.status(status).json({
    success: false,
    error: {
      code,
      message: safeMessage
    },
    requestId: req.id || 'req-unknown'
  });
}

module.exports = { errorHandler, sanitizeDatabaseError };
