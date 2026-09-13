/**
 * XPLOITX // CYBER BATTLEFIELD
 * In-Memory Sliding Window Rate Limiter (backend/middleware/rateLimit.js)
 */

const requestLog = new Map();

function rateLimiter({ windowMs = 60 * 1000, max = 10, message = 'Rate limit exceeded. Stand by.' } = {}) {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const key = `${ip}:${req.path}`;
    const now = Date.now();

    if (!requestLog.has(key)) {
      requestLog.set(key, []);
    }

    const timestamps = requestLog.get(key).filter(ts => now - ts < windowMs);
    if (timestamps.length >= max) {
      return res.status(429).json({
        error: 'RATE_LIMITED',
        message,
        retryAfterMs: windowMs - (now - timestamps[0])
      });
    }

    timestamps.push(now);
    requestLog.set(key, timestamps);
    next();
  };
}

module.exports = {
  rateLimiter,
  submissionLimiter: rateLimiter({ windowMs: 60 * 1000, max: 10, message: 'Too many flag submissions. Cooling down.' }),
  loginLimiter: rateLimiter({ windowMs: 60 * 1000, max: 15, message: 'Too many authentication attempts.' })
};
