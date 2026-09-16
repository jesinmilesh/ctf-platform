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
  // 1. Check for Multer-specific multipart upload errors
  if (err && (err.name === 'MulterError' || (typeof err.code === 'string' && err.code.startsWith('LIMIT_')))) {
    let status = 400;
    let code = err.code || 'UPLOAD_ERROR';
    let message = err.message || 'File upload failed';

    if (err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      code = 'FILE_TOO_LARGE';
      message = 'The uploaded file exceeds the allowable size limit.';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      status = 400;
      code = 'TOO_MANY_FILES';
      message = 'Too many files uploaded in a single batch.';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      status = 400;
      code = 'UNEXPECTED_FILE_FIELD';
      message = `Unexpected multipart field '${err.field || 'unknown'}'. Please attach assets using field 'files'.`;
    }

    return res.status(status).json({
      success: false,
      code,
      message,
      error: { code, message },
      requestId: req.id || 'req-unknown'
    });
  }

  // 2. Check for express body-parser / entity too large errors
  if (err && (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413)) {
    const code = 'REQUEST_TOO_LARGE';
    const message = 'Request payload exceeds the maximum allowed transfer size.';
    return res.status(413).json({
      success: false,
      code,
      message,
      error: { code, message },
      requestId: req.id || 'req-unknown'
    });
  }

  // 3. Check for file type rejection errors
  if (err && typeof err.message === 'string' && (err.message.startsWith('FILE_TYPE_REJECTED') || err.message.startsWith('FILE_TYPE_NOT_ALLOWED'))) {
    const code = 'FILE_TYPE_NOT_ALLOWED';
    const message = err.message.replace(/^FILE_TYPE_REJECTED:\s*/, '');
    return res.status(415).json({
      success: false,
      code,
      message,
      error: { code, message },
      requestId: req.id || 'req-unknown'
    });
  }

  // 4. Check for MongoDB-specific errors and sanitize completely
  const dbError = sanitizeDatabaseError(err);
  const status = dbError ? dbError.status : (err.status || err.statusCode || 500);
  const isServerErr = status >= 500;
  
  const code = dbError ? dbError.code : (err.code || (
    status === 401 ? 'AUTHENTICATION_REQUIRED' :
    status === 403 ? 'FORBIDDEN' :
    status === 404 ? 'NOT_FOUND' :
    status === 413 ? 'FILE_TOO_LARGE' :
    status === 415 ? 'FILE_TYPE_NOT_ALLOWED' :
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
    code,
    message: safeMessage,
    error: {
      code,
      message: safeMessage
    },
    requestId: req.id || 'req-unknown'
  });
}

module.exports = { errorHandler, sanitizeDatabaseError };
