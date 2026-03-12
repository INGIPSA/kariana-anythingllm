let _clerkMiddleware = null;

/**
 * Check if Clerk authentication is enabled via environment variables.
 * @returns {boolean}
 */
function isClerkEnabled() {
  return !!process.env.CLERK_SECRET_KEY && !!process.env.CLERK_PUBLISHABLE_KEY;
}

/**
 * Get the Clerk middleware instance for Express.
 * Returns null if Clerk is not enabled or not available.
 * @returns {Function|null}
 */
function getClerkMiddleware() {
  if (!isClerkEnabled()) return null;
  if (_clerkMiddleware) return _clerkMiddleware;
  try {
    const { clerkMiddleware } = require("@clerk/express");
    _clerkMiddleware = clerkMiddleware();
    return _clerkMiddleware;
  } catch (e) {
    console.warn("[Auth] Clerk middleware not available:", e.message);
    return null;
  }
}

/**
 * Validate a Clerk session from an incoming request.
 * Returns the Clerk userId if valid, null otherwise.
 * @param {import("express").Request} req
 * @returns {Promise<string|null>}
 */
async function validateClerkSession(req) {
  if (!isClerkEnabled()) return null;
  try {
    const { getAuth } = require("@clerk/express");
    const auth = getAuth(req);
    return auth?.userId || null;
  } catch (e) {
    return null;
  }
}

module.exports = { isClerkEnabled, getClerkMiddleware, validateClerkSession };
