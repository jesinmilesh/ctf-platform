/**
 * XPLOITX // CYBER BATTLEFIELD
 * Security Input Sanitizer & Injection Shield (backend/middleware/sanitizer.js)
 * Implements Sections 14, 66, 68, 69 of Architectural Specification:
 * - Blocks MongoDB operator injection ($where, $gt, $ne, $regex, etc.)
 * - Neutralizes Prototype Pollution attempts (__proto__, constructor, prototype)
 * - Validates and normalizes request payloads
 */

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isDangerousKey(key) {
  if (typeof key !== 'string') return false;
  if (DANGEROUS_KEYS.has(key)) return true;
  if (key.startsWith('$') || key.includes('.')) return true;
  return false;
}

function sanitizeObject(obj, depth = 0) {
  if (depth > 10) return obj; // Prevent excessive recursion DoS
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (typeof obj[i] === 'object' && obj[i] !== null) {
        sanitizeObject(obj[i], depth + 1);
      }
    }
    return obj;
  }

  const keys = Object.keys(obj);
  for (const key of keys) {
    if (isDangerousKey(key)) {
      delete obj[key];
      continue;
    }
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key], depth + 1);
    }
  }
  return obj;
}

function sanitizeInputMiddleware(req, res, next) {
  try {
    if (req.body && typeof req.body === 'object') {
      sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      sanitizeObject(req.query);
    }
    if (req.params && typeof req.params === 'object') {
      sanitizeObject(req.params);
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  sanitizeInputMiddleware,
  sanitizeObject,
  isDangerousKey
};
